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
        src = ./.;
      in {
        packages.default = pkgs.writeShellApplication {
          name = "form-sink";
          runtimeInputs = [ pkgs.deno ];
          text = ''
            deno run --allow-net --allow-read --allow-env ${src}/main.ts
          '';
        };

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
