# Setting up for Patina

Patina is based upon the foundations of UEFI, and as such, much of the tooling used to build boot firmware
continues to leverage the existing proven tools from Tianocore, such as the `stuart_build` set of commands, and many other parts familiar within the EDK II framework.

The steps to setting up the tooling can be found documented in the Readme of the [patina-qemu](https://github.com/OpenDevicePartnership/patina-qemu) repository.  This is a bit of a marathon, involving the EDK repository and other setup steps, so we'll walk through it here.

Much of the steps shown here are restructured from the [patina-qemu README](https://github.com/OpenDevicePartnership/patina-qemu?tab=readme-ov-file#first-time-tool-setup-instructions-for-this-repository). Developers more familiar with UEFI and the EDK II may find that document more direct.

The end result will be a set of Patina rust-based firmware running as a QEMU hosted emulated platform.  Once this is established, we can work with the firmware ourselves and/or we can target an actual platform board instead of the emulator.  But let's not get ahead of ourselves just yet.  First we need to get things into place.

## Qemu Q35 package
In these steps, we will be building an emulated platform based on the Intel Q35 chipset. This will demonstrate the Patina UEFI firmware development for x86/64.  The patina-qemu repository also has support for an ARM architecture. Refer there for more information.

## Preparing for "Stuart"
The EDK II build tool, `Stuart`, is avaiable by cloning the EDK2 repository from tianocore.

### Python
But before we go there, we need to make sure we have Python installed.
For Windows, download the [official Python installer]( https://www.python.org/downloads/windows/)

(For Linux or MacOS, consult available sources for installing Python for your platform).

The installer should install both `python` and `py` (python launcher).  Test your installation with

```
py -0
```
This should list the available python versions, and

```
python --version
```
should verify your default python version is available.

### EDK II
Now to get on with building the "Stuart" tools:

First, we need to clone the tianocore repository for this:

```
git clone https://github.com/tianocore/edk2.git
```

and then we are going to establish a virtual python environment in this space and use it to build the tools.

(Windows)
```
cd edk2
py -m venv .venv
.venv\Scripts\activate.bat
pip install -r pip-requirements.txt --upgrade
stuart_setup -c .pytool/CISettings.py
```

## Patina-qemu
Now we are equipped to build from the patina-qemu repository.
Start by cloning the patina-quemu repository to your workspace.  

```
git clone git@github.com:OpenDevicePartnership/patina-qemu.git
```

### Shorten the path
On Windows, the build commands reference pathnames that when combined can exceed the maximum allowed path length, so to prevent issues here, we will redirect where we work so that our paths are shorter.

Do this from within the patina-quemu repository root directory:

```
cd
<this will show you the full path of the repository root, where you are>
subst z: <full path shown above>

cd z:\
z:
```

now you should be able to treat your Z:\ location the same as your repository root, but the resulting path names will be shorter.

### Building
(from within your new Z:\ location)

```
# Create a Python virtual environment for this workspace
py -e -m venv patina.venv 
# and then activate it
.\patina.venv\Scripts\Activate.bat
```
Note that there is Activate.bat (for cmd) and Activate.ps1 (for PowerShell).  Use the one that matches your console shell.

Now install the python dependencies:
```
pip install --upgrade -r pip-requirements.txt
```
Then use the Stuart tools to setup and build:
```
stuart_setup -c Platforms\QemuQ35Pkg\PlatformBuild.py
stuart_upgrade -c Platforms\QemuQ35Pkg\PlatformBuild.py

stuart_build -c Platforms\QemuQ35Pkg\PlatformBuild.py

```
To build and install into QEMU, include the --FlashRom argument:
```
stuart_build -c Platforms\QemuQ35Pkg\PlatformBuild.py --FlashRom
```

building will take several minutes.  At the end of this you should see a QEMU window with a command prompt and output showing success.

### What did we just build?
The Patina DXE Core was successfully installed into your QEMU emulator!  But the actual Rust code for that is contained within a prebuilt .efi binary.  Next we will look at the steps you will need to take to update that .efi binary so that _your_ firmware development can be set into place.


