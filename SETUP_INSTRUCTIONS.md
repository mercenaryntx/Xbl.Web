# Instructions to Complete the Setup

## Add Xbl.Web.Shared to the Solution

You need to manually add the Xbl.Web.Shared project to the solution file. Run the following command:

```powershell
dotnet sln Xbl.sln add Xbl.Web.Shared\Xbl.Web.Shared.csproj
```

Or, manually edit the `Xbl.sln` file and add the following project entry after the other projects:

```
Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "Xbl.Web.Shared", "Xbl.Web.Shared\Xbl.Web.Shared.csproj", "{GENERATE-NEW-GUID}"
EndProject
```

Then add it to the GlobalSection(ProjectConfigurationPlatforms):

```
{GENERATE-NEW-GUID}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
{GENERATE-NEW-GUID}.Debug|Any CPU.Build.0 = Debug|Any CPU
{GENERATE-NEW-GUID}.Release|Any CPU.ActiveCfg = Release|Any CPU
{GENERATE-NEW-GUID}.Release|Any CPU.Build.0 = Release|Any CPU
```

## Restore NuGet Packages

After adding to the solution, restore NuGet packages:

```powershell
dotnet restore
```

## Build the Solution

```powershell
dotnet build
```

## Summary of Changes

### Created:
1. **Xbl.Web.Shared** project with:
   - NullConsole.cs
   - NullProgressContext.cs

### Modified:
1. **Xbl.Web** project:
   - Added reference to Xbl.Web.Shared
   - Updated Program.cs to use `Xbl.Web.Shared` namespace
   - Removed NullConsole.cs and NullProgressContext.cs

2. **Xbl.Function** project:
   - Added reference to Xbl.Web.Shared
   - Updated Program.cs to use NullConsole from Xbl.Web.Shared
   - Removed FunctionConsole.cs and FunctionProgressContext.cs

### Benefits:
- ? **Code Reuse**: Both projects share the same console implementation
- ? **Simplified Maintenance**: Changes to shared infrastructure only need to be made once
- ? **Consistency**: Both projects use identical console behavior
- ? **Clean Architecture**: Proper separation of concerns
