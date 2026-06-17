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

        form-sink-bin = pkgs.runCommand "form-sink"
          {
            nativeBuildInputs = [ pkgs.deno ];
          }
          ''
            mkdir -p $out/bin work
            cp -r ${./.}/src work/
            cp ${./.}/deno.json work/
            cp ${./.}/deno.lock work/

            cd work
            deno compile \
              --lock deno.lock \
              --output $out/bin/form-sink \
              --allow-net \
              --allow-read \
              --allow-env \
              --allow-write \
              src/main.ts
          '';

      in {
        packages.default = form-sink-bin;

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            deno
          ];
        };
      }
    ) // {
      nixosModules.default = import ./nixos/module.nix;
    };
}
