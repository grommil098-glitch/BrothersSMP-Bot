{ pkgs }: {
	deps = [
   pkgs.gnumake
   pkgs.gcc
   pkgs.python3
   pkgs.cmake
		pkgs.nodejs-16_x
        pkgs.nodePackages.typescript-language-server
        pkgs.yarn
        pkgs.replitPackages.jest
	];
}