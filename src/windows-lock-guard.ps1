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
  [DllImport("ntdll.dll")] static extern int NtQuerySystemInformation(int c, IntPtr b, int n, out int used);
  public static string BootId() {
    IntPtr b = Marshal.AllocHGlobal(64);
    try {
      int used;
      // SystemBootEnvironmentInformation starts with the kernel boot GUID.
      if (NtQuerySystemInformation(90,b,64,out used)!=0 || used<16) throw new InvalidOperationException();
      return ((Guid)Marshal.PtrToStructure(b,typeof(Guid))).ToString();
    } finally { Marshal.FreeHGlobal(b); }
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
  $data = @{ owner = @{ pid = [int]$q.pid; created = $value[0]; image = $value[1] }; boot = @{ machine = [string]$machine; id = [DevoutLockIdentity]::BootId() } }
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
