REM make book
md .temp
md .temp\guide
md .temp\tracks  
cd guide_book
mdbook clean
mdbook build
REM move into place
xcopy "book\*" ".\..\.temp\guide" /E /I /Y

REM copy the common toml and mermaid files
copy ".\book.toml" "..\tracks\adviser\" /Y
copy ".\mermaid*" "..\tracks\adviser\" /Y
copy ".\book.toml" "..\tracks\contributor\" /Y
copy ".\mermaid*" "..\tracks\contributor\" /Y
copy ".\book.toml" "..\tracks\embedded_controller\" /Y    
copy ".\mermaid*" "..\tracks\embedded_controller\" /Y
copy ".\book.toml" "..\tracks\engineer\" /Y
copy ".\mermaid*" "..\tracks\engineer\" /Y   
copy ".\book.toml" "..\tracks\integrator\" /Y
copy ".\mermaid*" "..\tracks\integrator\" /Y
copy ".\book.toml" "..\tracks\patina\" /Y 
copy ".\mermaid*" "..\tracks\patina\" /Y
copy ".\book.toml" "..\tracks\security\" /Y
copy ".\mermaid*" "..\tracks\security\" /Y
copy ".\book.toml" "..\tracks\value_proposition\" /Y
copy ".\mermaid*" "..\tracks\value_proposition\" /Y

REM copy content shared across tracks
xcopy ".\src\why\*" "..\tracks\value_proposition\src\why" /E /I /Y
xcopy ".\src\intro\concepts\patina.md" "..\tracks\patina\src\patina_concepts.md" /E /I /Y

REM make all track books and copy into place
cd ..\tracks\advisor 
mdbook clean
mdbook build
xcopy "book\*" "..\..\.temp\tracks\advisor" /E /I /Y
cd ..\contributor
mdbook clean                
mdbook build
xcopy "book\*" "..\..\.temp\tracks\contributor" /E /I /Y
cd ..\embedded_controller
mdbook clean
mdbook build
xcopy "book\*" "..\..\.temp\tracks\embedded_controller" /E /I /Y
cd ..\engineer
mdbook clean
mdbook build    
xcopy "book\*" "..\..\.temp\tracks\engineer" /E /I /Y
cd ..\integrator
mdbook clean        
mdbook build
xcopy "book\*" "..\..\.temp\tracks\integrator" /E /I /Y
cd ..\patina
mdbook clean
mdbook build
xcopy "book\*" "..\..\.temp\tracks\patina" /E /I /Y
cd ..\security
mdbook clean    
mdbook build
xcopy "book\*" "..\..\.temp\tracks\security" /E /I /Y
cd ..\value_proposition
mdbook clean    
mdbook build   
xcopy "book\*" "..\..\.temp\tracks\value_proposition" /E /I /Y