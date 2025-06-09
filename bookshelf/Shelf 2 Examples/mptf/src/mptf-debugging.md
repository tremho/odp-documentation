# Debugging
This section describes the order you should follow when validating the MPTF and log files to capture.

## Loading Drivers
The first step is to make sure the MPTF drivers are loaded successfully in device manager.

In device manager expand the Thermal devices tab to make sure see the following three devices listed without any yellow bang.

![MPTF Driver](media/device_manager.png)

If you don't see the "Thermal devices" in device manager, you are either missing the ACPI entries or the files are not present in your windows folder. Review the sections on ACPI and the MPTF drivers to make sure all the files are present.

If MPTF Core Driver is present but yellow banged, this is normally because of a failure in parsing the PocIF.txt and PocSpec.txt files in the root folder. Make sure these are present and look valid or try a simpler file. If they are valid collect logs that are listed in the Logging section below and review/share.

If Microsoft Customized IO Driver is present but yellow banged, this is normally an issue with your configuration files and ACPI _DSM definitions for input and output devices. Review your ACPI entries for MSFT0011 and make sure all functions referenced in the PocIF.txt are present and valid in your ACPI tables. For further debug collect logs and see section on ACPI debugging to debug ACPI

If MPTF Custom IO Signal Client River is present but yellow banged, this indicates there is normally a problem in your custom input/output driver component. Enable logging in your driver and make sure it is loaded successfully and no failures. Enable all other logs under logging and review content.

Sometimes drivers will not load correctly if the MPTF service is not running so be sure to make sure in your service manager that MPTF service is running and set to automatically start.

![MPTF service](media/mptf_service.png)


## Logging

Both the MPTF Core Driver and Microsoft Customized IO Driver support WPP logging. Make sure you enable the logs from boot so we have a complete picture of what happend. These can be enabled via registry settings with autologger or through windbg using the following commands:

```
!wmitrace.stop MptfCore -kd
!wmitrace.stop MptfIo -kd
!wmitrace.start MptfCore -kd
!wmitrace.start MptfIo -kd
!wmitrace.enable MptfCore {9BBAB94F-A0B0-4F96-8966-A04F9BA72CA0} -level 0x7 -flag 0xFFFF
!wmitrace.enable MptfIo {D0ABE2A4-A604-4BEE-8987-55C529C06185} -level 0x7 -flag 0xFFFF
!wmitrace.dynamicprint 1
```

<b>Note: </b> You can use `<ctrl>+<alt>+k` in windbg to enable break on connect. For WMI tracing system to be initialized you will need to boot past classpnp till all the boot critical drivers are loaded and logging system is initailized.

dynamicprint will display messages in windbg and sometimes slow down execution so only use this if you want to see your messages printed in real time.

To list your current running loggers

```
!wmitrace.strdump
...
    Logger Id 0x2b @ 0xFFFFD70C4679F040 Named 'MptfCore'
    Logger Id 0x2e @ 0xFFFFD70C4643A780 Named 'MptfIo'
```

To dump logger contents to windbg

`!wmitrace.logdump MptfCore`

To save logger contents to file

`!wmitrace.logsave MptfCore c:\temp\mptfcore.log`

When changing input values you should see from the logs it reads the input value and tries to write the corresponding output values. In the log below I changed input value to 3 and this maps to output value of 25 in my PocSpec.txt

```
[3]0004.0378::04/25/2025-15:32:53.903 [kernel] [DMF_SmfProcessing_DataUpdate]Received data: Id 0x000028F3CCEC08F8, Channel 0, Value 3
[1]0004.0300::04/25/2025-15:32:53.919 [kernel] [SmfCore_ProcessingOutputUpdate]Preparing send data: Id 0x000028F3CDB8BEC8, Channel 0, Value 25
```

If using secure EC services and sending commands via FFA these logs are captured to the serial port, in this case you should see the output channel value being written to the variable on the serial port logs
```
15:29:00.621 : SP 8003: DEBUG - set_variable instance id: 0x1
15:29:00.622 : SP 8003:                 length: 0x4
15:29:00.623 : SP 8003:                 uuid: 5cf839df-8be7-42b9-9ac5-3403ca2c8a6a
15:29:00.623 : SP 8003:                 data: 0x19
```

## ACPI Debugging
Since input and output devices go through ACPI calls you may find yourself needing to debug content in ACPI. 

```
!amli set spewon verboseon traceon dbgbrkon
!amli bp \_SB.CIO1._DSM
!amli bl
!amli dns /s \_SB.CIO1
```

For further details on ACPI debugging see [AMLI Debugging](https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/introduction-to-the-amli-debugger)