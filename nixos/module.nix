# NixOS module for form-sink
# TODO: implement in task 10
{ lib, pkgs, config, ... }:
with lib;
let
  cfg = config.services.form-sink;
in {
  options.services.form-sink = {
    enable = mkEnableOption "form-sink service";
  };
  config = mkIf cfg.enable {
    # TODO: systemd service definition
  };
}
