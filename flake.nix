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

        form-sink-bin = pkgs.stdenv.mkDerivation {
          name = "form-sink";
          src = ./.;

          nativeBuildInputs = [ pkgs.makeWrapper ];
          buildInputs    = [ pkgs.deno ];

          dontBuild = true;
          installPhase = ''
            mkdir -p $out/bin
            cp -r src vendor deno.json deno.lock $out/

            cat > $out/bin/form-sink <<WRAPPER
            #!/usr/bin/env bash
            set -euo pipefail
            exec deno run \\
              --allow-net \\
              --allow-read \\
              --allow-env \\
              --allow-write \\
              --vendor \\
              --lock=${toString ./.}/deno.lock \\
              ${toString ./.}/src/main.ts "$@"
            WRAPPER

            chmod +x $out/bin/form-sink
            wrapProgram $out/bin/form-sink --prefix PATH : "${pkgs.bash}/bin" --prefix PATH : "${pkgs.deno}/bin"
          '';
        };

      in {
        packages.default = form-sink-bin;

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            deno
            jq
          ];
        };
      }
    ) // {
      nixosModules.default = import ./nixos/module.nix;
    };
}
