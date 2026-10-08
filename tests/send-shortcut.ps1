# Send the test's already registered Ctrl+Alt+Shift+F9 through Windows itself.
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class TestShortcutInput {
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public UNION data; }
  [StructLayout(LayoutKind.Explicit)] public struct UNION {
    [FieldOffset(0)] public KEYBOARD keyboard;
    [FieldOffset(0)] public MOUSE mouse;
  }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBOARD {
    public ushort vk, scan; public uint flags, time; public UIntPtr extra;
  }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSE {
    public int x, y; public uint mouseData, flags, time; public UIntPtr extra;
  }
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, INPUT[] input, int size);
  public static void Send() {
    ushort[] keys = { 0x11, 0x12, 0x10, 0x78, 0x78, 0x10, 0x12, 0x11 };
    INPUT[] events = new INPUT[8];
    for (int i=0;i<8;i++) { events[i].type=1; events[i].data.keyboard.vk=keys[i]; events[i].data.keyboard.flags=i<4 ? 0u : 2u; }
    uint sent=SendInput(8,events,Marshal.SizeOf(typeof(INPUT)));
    if(sent!=8) throw new Exception("SendInput injected "+sent+"/8 events; Windows error "+Marshal.GetLastWin32Error());
  }
}
'@
[TestShortcutInput]::Send()
