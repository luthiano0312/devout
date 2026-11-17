# Private Driver helper. Invoked with -EncodedCommand, without policy changes.
# No kill-on-close: losing this observer must report uncertainty, not kill blindly.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
public sealed class DevoutJob : IDisposable {
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr a, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr j, IntPtr p);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr j, int c, IntPtr b, uint n, out uint r);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr p, out long c, out long e, out long k, out long u);
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr p, int f, StringBuilder b, ref int n);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h, uint ms);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Entry {
    public uint size, usage, pid; public IntPtr heap; public uint module, threads, parent;
    public int priority; public uint flags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string exe;
  }
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateToolhelp32Snapshot(uint f, uint p);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool Process32FirstW(IntPtr s, ref Entry e);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool Process32NextW(IntPtr s, ref Entry e);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool IsProcessInJob(IntPtr p, IntPtr j, out bool inside);
  IntPtr job, root;
  public int RootPid { get; private set; }
  public string Created { get; private set; }
  public string Image { get; private set; }
  static Exception Error() { return new Win32Exception(Marshal.GetLastWin32Error()); }
  static string Creation(IntPtr p) {
    long c,e,k,u; if (!GetProcessTimes(p,out c,out e,out k,out u)) throw Error();
    return c.ToString(System.Globalization.CultureInfo.InvariantCulture);
  }
  public DevoutJob(int pid, string expectedImage, long earliestMs) {
    try {
      // Keep the exact kernel process object open through verification/taskkill.
      root = OpenProcess(0x101101, false, pid);
      if (root == IntPtr.Zero) throw Error();
      RootPid = pid; Created = Creation(root);
      var b = new StringBuilder(32768); int n = b.Capacity;
      if (!QueryFullProcessImageName(root,0,b,ref n)) throw Error();
      Image = b.ToString();
      if (!String.Equals(Image,expectedImage,StringComparison.OrdinalIgnoreCase) ||
          DateTime.FromFileTimeUtc(Int64.Parse(Created)) < DateTimeOffset.FromUnixTimeMilliseconds(earliestMs).UtcDateTime ||
          !Alive()) throw new InvalidOperationException("identity");
      job = CreateJobObject(IntPtr.Zero, null);
      if (job == IntPtr.Zero || !AssignProcessToJobObject(job,root)) throw Error();
      AttachBootstrapConsole();
      // Default job limits disallow breakaway. All subsequent child processes
      // are assigned by the kernel, including children between observations.
    } catch { Dispose(); throw; }
  }
  public bool Alive() { return root != IntPtr.Zero && WaitForSingleObject(root,0) == 258; }
  public int[] Members() {
    for (int size=256; size<=1048576; size*=2) {
      IntPtr b=Marshal.AllocHGlobal(size);
      try {
        uint used;
        if (!QueryInformationJobObject(job,3,b,(uint)size,out used)) {
          if (Marshal.GetLastWin32Error()==234) continue;
          throw Error();
        }
        int count=Marshal.ReadInt32(b,4);
        if (count<0 || 8+(long)count*IntPtr.Size>size) throw new InvalidOperationException("inventory");
        int[] ids=new int[count];
        for (int i=0;i<count;i++) ids[i]=checked((int)Marshal.ReadIntPtr(b,8+i*IntPtr.Size).ToInt64());
        return ids;
      } finally { Marshal.FreeHGlobal(b); }
    }
    throw new InvalidOperationException("inventory limit");
  }
  public string MemberCreation(int pid) {
    IntPtr p=OpenProcess(0x1000,false,pid);
    if (p==IntPtr.Zero) return null; // Can exit between job query and observation.
    try { return Creation(p); } finally { CloseHandle(p); }
  }
  void AttachBootstrapConsole() {
    // Windows may create conhost before the gated Node host is assigned.
    // Enroll only its verified, current, system-image console child, never an
    // arbitrary process sharing a recycled parent PID. No Pi has launched yet.
    IntPtr snap=CreateToolhelp32Snapshot(2,0);
    if (snap==new IntPtr(-1)) throw Error();
    try {
      Entry e=new Entry(); e.size=(uint)Marshal.SizeOf(typeof(Entry));
      if (!Process32FirstW(snap,ref e)) throw Error();
      do {
        if (e.parent!=(uint)RootPid) continue;
        IntPtr p=OpenProcess(0x101101,false,checked((int)e.pid));
        if (p==IntPtr.Zero) throw Error();
        try {
          var b=new StringBuilder(32768); int n=b.Capacity;
          if (!QueryFullProcessImageName(p,0,b,ref n) ||
              !String.Equals(b.ToString(),System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"conhost.exe"),StringComparison.OrdinalIgnoreCase) ||
              Int64.Parse(Creation(p))<Int64.Parse(Created) || WaitForSingleObject(p,0)!=258)
            throw new InvalidOperationException("foreign descendant");
          if (!AssignProcessToJobObject(job,p)) throw Error();
        } finally { CloseHandle(p); }
      } while (Process32NextW(snap,ref e));
    } finally { CloseHandle(snap); }
  }
  System.Collections.Generic.List<IntPtr> PinTaskkillTree() {
    // taskkill /T can follow parent PIDs. Refuse stale parent links to processes
    // outside our kernel job (including descendants of an earlier PID owner).
    IntPtr snap=CreateToolhelp32Snapshot(2,0);
    if (snap==new IntPtr(-1)) throw Error();
    var entries=new System.Collections.Generic.List<Entry>();
    try {
      Entry e=new Entry(); e.size=(uint)Marshal.SizeOf(typeof(Entry));
      if (!Process32FirstW(snap,ref e)) throw Error();
      do { entries.Add(e); } while (Process32NextW(snap,ref e));
      if (Marshal.GetLastWin32Error()!=18) throw Error();
    } finally { CloseHandle(snap); }
    var ids=new System.Collections.Generic.HashSet<uint>(); ids.Add((uint)RootPid);
    bool changed;
    do {
      changed=false;
      foreach (Entry e in entries) if (ids.Contains(e.parent) && ids.Add(e.pid)) changed=true;
    } while (changed);
    var handles=new System.Collections.Generic.List<IntPtr>();
    try {
      foreach (uint pid in ids) {
        IntPtr p=OpenProcess(0x1000,false,checked((int)pid));
        if (p==IntPtr.Zero) throw new InvalidOperationException("ambiguous descendant");
        handles.Add(p);
        bool inside;
        if (!IsProcessInJob(p,job,out inside) || !inside) throw new InvalidOperationException("foreign descendant");
      }
      return handles;
    } catch { foreach (IntPtr h in handles) CloseHandle(h); throw; }
  }
  public int Force(int timeoutMs) {
    if (!Alive() || Creation(root)!=Created) throw new InvalidOperationException("identity");
    var pinned=PinTaskkillTree();
    try {
      if (!Alive()) throw new InvalidOperationException("identity");
      using (var killer=new Process()) {
      killer.StartInfo.FileName=System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"taskkill.exe");
      killer.StartInfo.Arguments="/PID "+RootPid.ToString()+" /T /F";
      killer.StartInfo.UseShellExecute=false;
      killer.StartInfo.CreateNoWindow=true;
      // Suppress taskkill text: only the subsequent kernel job query is proof.
      killer.StartInfo.RedirectStandardOutput=true;
      killer.StartInfo.RedirectStandardError=true;
      killer.OutputDataReceived += (s,e) => {}; killer.ErrorDataReceived += (s,e) => {};
      killer.Start(); killer.BeginOutputReadLine(); killer.BeginErrorReadLine();
      if (!killer.WaitForExit(timeoutMs)) { killer.Kill(); throw new TimeoutException(); }
        return killer.ExitCode;
      }
    } finally { foreach (IntPtr h in pinned) CloseHandle(h); }
  }
  public void Dispose() {
    if (job!=IntPtr.Zero) { CloseHandle(job); job=IntPtr.Zero; }
    if (root!=IntPtr.Zero) { CloseHandle(root); root=IntPtr.Zero; }
  }
}
'@
$job = $null
try {
  while ($null -ne ($line = [Console]::ReadLine())) {
    $id = $null
    try {
      $q = $line | ConvertFrom-Json
      $id = $q.id
      $data = $null
      switch ($q.op) {
        'attach' {
          if ($null -ne $job) { throw 'already attached' }
          $p = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + [int]$q.pid)
          if ($null -eq $p -or [int]$p.ParentProcessId -ne [int]$q.parentPid) { throw 'parent identity' }
          $job = [DevoutJob]::new([int]$q.pid, [string]$q.image, [long]$q.earliestMs)
          $data = @{ pid = $job.RootPid; created = $job.Created; image = $job.Image }
        }
        'snapshot' {
          if ($null -eq $job) { throw 'not attached' }
          $members = @($job.Members() | ForEach-Object { @{ pid = $_; created = $job.MemberCreation($_) } })
          $data = @{ rootAlive = $job.Alive(); members = $members }
        }
        'force' { $data = @{ exitCode = $job.Force([int]$q.timeoutMs) } }
        'dispose' { $job.Dispose(); $job = $null; $data = @{ disposed = $true } }
        default { throw 'unknown operation' }
      }
      [Console]::WriteLine((@{ id = $id; ok = $true; data = $data } | ConvertTo-Json -Depth 5 -Compress))
    } catch {
      # Do not leak paths, command lines or exception/provider contents.
      $cause = $_.Exception
      while ($null -ne $cause.InnerException) { $cause = $cause.InnerException }
      $code = 'PROCESS_OBSERVATION_FAILED'
      if ($cause -is [System.ComponentModel.Win32Exception]) { $code = 'PROCESS_WIN32_' + $cause.NativeErrorCode }
      if ($cause -is [System.InvalidOperationException]) {
        switch ($cause.Message) {
          'identity' { $code = 'PROCESS_IDENTITY_CHANGED' }
          'ambiguous descendant' { $code = 'PROCESS_DESCENDANT_AMBIGUOUS' }
          'foreign descendant' { $code = 'PROCESS_FOREIGN_DESCENDANT' }
          'inventory' { $code = 'PROCESS_INVENTORY_INVALID' }
        }
      }
      [Console]::WriteLine((@{ id = $id; ok = $false; code = $code } | ConvertTo-Json -Compress))
    }
  }
} finally { if ($null -ne $job) { $job.Dispose() } }
