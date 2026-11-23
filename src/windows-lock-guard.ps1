# Private, temporary file-share guard. No kill operations or policy changes.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
public static class DevoutLockIdentity {
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr p, out long c, out long e, out long k, out long u);
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr p, int f, StringBuilder b, ref int n);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h, uint ms);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  struct Version {
    public uint Size, Major, Minor, Build, Platform;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string ServicePack;
  }
  [StructLayout(LayoutKind.Sequential)]
  struct SystemInfo {
    public ushort Architecture, Reserved;
    public uint PageSize;
    public IntPtr MinimumAddress, MaximumAddress, ProcessorMask;
    public uint ProcessorCount, ProcessorType, AllocationGranularity;
    public ushort ProcessorLevel, ProcessorRevision;
  }
  [DllImport("kernel32.dll")] static extern void GetNativeSystemInfo(out SystemInfo info);
  [DllImport("ntdll.dll", CharSet=CharSet.Unicode)] static extern int RtlGetVersion(ref Version version);
  public static uint[] BootId() {
    // Same native fields/offsets as the independently measured candidate probe.
    SystemInfo system; GetNativeSystemInfo(out system);
    if (IntPtr.Size != 8 || system.Architecture != 9 ||
        Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE") != "AMD64")
      throw new InvalidOperationException("Unqualified architecture");
    var v = new Version(); v.Size = (uint)Marshal.SizeOf(typeof(Version));
    if (RtlGetVersion(ref v) != 0 || v.Major != 10 || v.Minor != 0 || v.Build != 19045)
      throw new InvalidOperationException("Unqualified Windows build");
    var page = new IntPtr(0x7ffe0000L);
    uint build = unchecked((uint)Marshal.ReadInt32(page, 0x260)) & 0x0fffffffU;
    if (build != v.Build) throw new InvalidOperationException("Shared page layout mismatch");
    uint first = unchecked((uint)Marshal.ReadInt32(page, 0x2c4));
    uint second = unchecked((uint)Marshal.ReadInt32(page, 0x2c4));
    if (first != second) throw new InvalidOperationException("Unstable kernel identity");
    return new uint[] { first, build };
  }
  public static string[] Read(int pid) {
    IntPtr p=OpenProcess(0x101000,false,pid); // query limited information + synchronize
    if (p==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
    try {
      long c,e,k,u;
      if (!GetProcessTimes(p,out c,out e,out k,out u)) throw new Win32Exception(Marshal.GetLastWin32Error());
      var b=new StringBuilder(32768); int n=b.Capacity;
      if (!QueryFullProcessImageName(p,0,b,ref n)) throw new Win32Exception(Marshal.GetLastWin32Error());
      uint state=WaitForSingleObject(p,0);
      if (state!=0 && state!=258) throw new InvalidOperationException();
      return new string[] { c.ToString(System.Globalization.CultureInfo.InvariantCulture), b.ToString(), state==258 ? "alive" : "gone" };
    } finally { CloseHandle(p); }
  }
  public static string Probe(int pid, string created, string image) {
    try {
      string[] value=Read(pid);
      if (value[0]!=created || !String.Equals(value[1],image,StringComparison.OrdinalIgnoreCase)) return "reused";
      return value[2];
    } catch (Win32Exception e) { return e.NativeErrorCode==87 ? "gone" : "unknown"; }
      catch { return "unknown"; }
  }
}
'@
$guard = $null
$id = 0
try {
  $q = [Console]::ReadLine() | ConvertFrom-Json
  $parent = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $PID)
  if ([int]$parent.ParentProcessId -ne [int]$q.pid) { throw 'owner' }
  try {
    # Never unlink/replace this file. FileShare.None serializes independent Node
    # invocations and reconciliation; process death releases the kernel handle.
    $guard = [IO.File]::Open([string]$q.path, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  } catch [IO.IOException] {
    $native = $_.Exception.HResult -band 65535
    if ($native -eq 32 -or $native -eq 33) {
      [Console]::WriteLine('{"id":0,"ok":false,"code":"LOCK_BUSY"}')
      exit 0
    }
    throw
  }
  $value = [DevoutLockIdentity]::Read([int]$q.pid)
  if ($value[2] -ne 'alive') { throw 'owner' }
  $machine = [Microsoft.Win32.Registry]::GetValue('HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography', 'MachineGuid', $null)
  if ([string]::IsNullOrEmpty($machine)) { throw 'machine identity' }
  $kernel = [DevoutLockIdentity]::BootId()
  $data = @{ owner = @{ pid = [int]$q.pid; created = $value[0]; image = $value[1] }; boot = @{
    machine = [string]$machine; id = $kernel[0].ToString([Globalization.CultureInfo]::InvariantCulture)
    source = 'windows-kuser-shared-data-bootid-v1'; architecture = 'AMD64'; build = [int]$kernel[1]
  } }
  [Console]::WriteLine((@{ id = 0; ok = $true; data = $data } | ConvertTo-Json -Depth 5 -Compress))
  while ($null -ne ($line = [Console]::ReadLine())) {
    $q = $line | ConvertFrom-Json
    $id = $q.id
    switch ($q.op) {
      'check' { $data = @{ held = $true } }
      'probe' { $data = @{ status = [DevoutLockIdentity]::Probe([int]$q.identity.pid, [string]$q.identity.created, [string]$q.identity.image) } }
      'close' { break }
      default { throw 'operation' }
    }
    if ($q.op -eq 'close') { break }
    [Console]::WriteLine((@{ id = $id; ok = $true; data = $data } | ConvertTo-Json -Depth 5 -Compress))
  }
} catch {
  [Console]::WriteLine((@{ id = $id; ok = $false; code = 'LOCK_OBSERVATION_FAILED' } | ConvertTo-Json -Compress))
} finally { if ($null -ne $guard) { $guard.Dispose() } }
