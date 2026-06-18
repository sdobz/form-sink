{
  description = "An endpoint to capture form submissions and email them";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
        lib = pkgs.lib;

        form-sink-bin = pkgs.stdenv.mkDerivation {
          name = "form-sink";
          src = ./.;

          nativeBuildInputs = [ ];
          buildInputs    = [ pkgs.deno ];

          dontBuild = true;
          installPhase = ''
            mkdir -p $out/bin
            cp -r src vendor deno.json deno.lock $out/

            cat > $out/bin/form-sink <<WRAPPER
            #!/usr/bin/env bash
            export DENO_SQLITE_PATH="${lib.makeLibraryPath [ pkgs.sqlite ]}/libsqlite3${pkgs.stdenv.hostPlatform.extensions.sharedLibrary}"
            set -euo pipefail
            exec ${pkgs.deno}/bin/deno run \\
              --allow-net \\
              --allow-read \\
              --allow-env \\
              --allow-write \\
              --allow-ffi \\
              --vendor \\
              --lock=${toString ./.}/deno.lock \\
              ${toString ./.}/src/main.ts "\$@"
            WRAPPER

            chmod +x $out/bin/form-sink
          '';
        };

      in {
        packages.default = form-sink-bin;

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            deno
            sqlite
          ];
        };
      }
    ) // {
      nixosModules.default = import ./nixos/module.nix;
    };
}
