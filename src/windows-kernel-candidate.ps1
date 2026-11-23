# Qualification probe ONLY. Never used to authorize Pi lease recovery.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DevoutKernelCandidate {
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
  public static uint[] Read() {
    // Fixed user shared page layout on Windows 10/11 AMD64 only. Unsupported
    // architectures/build families fail closed instead of guessing an offset.
    SystemInfo system; GetNativeSystemInfo(out system);
    if (IntPtr.Size != 8 || system.Architecture != 9 ||
        Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE") != "AMD64")
      throw new InvalidOperationException("Unsupported architecture");
    var v = new Version(); v.Size = (uint)Marshal.SizeOf(typeof(Version));
    if (RtlGetVersion(ref v) != 0 || v.Major != 10 || v.Minor != 0 || v.Build < 10240)
      throw new InvalidOperationException("Unsupported Windows version");
    var page = new IntPtr(0x7ffe0000L);
    // ntddk.h KUSER_SHARED_DATA: NtBuildNumber at 0x260, BootId at 0x2c4.
    uint build = unchecked((uint)Marshal.ReadInt32(page, 0x260)) & 0x0fffffffU;
    if (build != v.Build) throw new InvalidOperationException("Shared page layout mismatch");
    uint first = unchecked((uint)Marshal.ReadInt32(page, 0x2c4));
    uint second = unchecked((uint)Marshal.ReadInt32(page, 0x2c4));
    if (first != second) throw new InvalidOperationException("Unstable candidate");
    return new uint[] { first, build };
  }
}
'@
try {
  $value = [DevoutKernelCandidate]::Read()
  $machine = [Microsoft.Win32.Registry]::GetValue('HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography', 'MachineGuid', $null)
  if ([string]::IsNullOrEmpty($machine)) { throw 'machine identity missing' }
  $os = Get-CimInstance Win32_OperatingSystem
  $boot = Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-Kernel-General'; Id = 12 } -MaxEvents 1
  # Sanitized corroborating observations, NOT process-death/recovery proofs.
  # Keep only event identity and power state fields, never entire event messages.
  $power = @()
  try {
    $events = Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-Kernel-Power'; Id = @(42, 107) } -MaxEvents 12 -ErrorAction Stop
    foreach ($event in $events) {
      $xml = [xml]$event.ToXml()
      $fields = @{}
      foreach ($field in $xml.Event.EventData.Data) {
        if ($field.Name -in @('TargetState', 'EffectiveState')) { $fields[[string]$field.Name] = [string]$field.'#text' }
      }
      $power += @{ id = [int]$event.Id; recordId = [string]$event.RecordId; at = $event.TimeCreated.ToUniversalTime().ToString('o'); states = $fields }
    }
  } catch { $power = @() } # Missing power observations stay missing, never a positive result.
  $data = @{
    source = 'windows-kuser-shared-data-bootid-v1'; qualified = $false
    id = $value[0].ToString([Globalization.CultureInfo]::InvariantCulture)
    build = [int]$value[1]; architecture = 'AMD64'; machine = [string]$machine
    lastBootUpTime = $os.LastBootUpTime.ToUniversalTime().ToString('o')
    kernelStart = @{ recordId = [string]$boot.RecordId; at = $boot.TimeCreated.ToUniversalTime().ToString('o') }
    powerEvents = @($power)
  }
  [Console]::WriteLine(($data | ConvertTo-Json -Depth 7 -Compress))
} catch {
  [Console]::Error.WriteLine('KERNEL_CANDIDATE_OBSERVATION_FAILED')
  exit 1
}
