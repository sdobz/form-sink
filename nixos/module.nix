# NixOS module for form-sink
{ lib, config, ... }:
with lib;
let
  cfg = config.services.form-sink;
in {
  options.services.form-sink = {
    enable = mkEnableOption "form-sink service";

    port = mkOption {
      type = types.int;
      default = 8080;
      description = "Port the form-sink HTTP server listens on.";
    };

    dataDir = mkOption {
      type = types.path;
      default = "/var/lib/form-sink";
      description = "Directory where form-sink.db is stored.";
    };

    templatesDir = mkOption {
      type = types.path;
      description = "Path to the templates directory.";
    };

    adminEmail = mkOption {
      type = types.str;
      description = "Email address for admin notification emails.";
    };

    redirectUrl = mkOption {
      type = types.str;
      description = "URL to redirect the browser to after a successful submission.";
    };

    allowedOrigins = mkOption {
      type = types.listOf types.str;
      default = [ ];
      description = "List of allowed origins for CORS.";
    };

    smtp = {
      host = mkOption {
        type = types.str;
        description = "SMTP server hostname.";
      };

      port = mkOption {
        type = types.int;
        default = 587;
        description = "SMTP server port.";
      };

      user = mkOption {
        type = types.str;
        description = "SMTP authentication username.";
      };

      passwordFile = mkOption {
        type = types.path;
        description = "Path to a file containing the SMTP password (read at runtime).";
      };
    };

    turnstile = {
      secretFile = mkOption {
        type = types.path;
        description = "Path to a file containing the Cloudflare Turnstile secret key (read at runtime).";
      };
    };

    package = mkOption {
      type = types.path;
      defaultText = literalMD "self.packages.<system>.default (from your flake)";
      description = "Path to the compiled form-sink package (self.packages.<system>.default).";
    };
  };

  config = mkIf cfg.enable {
    # Dedicated user and group
    users.users.form-sink = {
      isSystemUser = true;
      group = "form-sink";
      home = cfg.dataDir;
      createHome = true;
    };

    users.groups.form-sink = { };

    # Systemd service
    systemd.services.form-sink = {
      description = "form-sink — form submission endpoint";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];

      serviceConfig = {
        Type = "simple";
        User = "form-sink";
        Group = "form-sink";
        StateDirectory = "form-sink";

        # Runtime environment from secrets
        EnvironmentFile = [
          "${cfg.smtp.passwordFile}"
          "${cfg.turnstile.secretFile}"
        ];

        # Static environment variables
        Environment = [
          "PORT=${toString cfg.port}"
          "DATA_DIR=${cfg.dataDir}"
          "TEMPLATES_DIR=${toString cfg.templatesDir}"
          "ADMIN_EMAIL=${cfg.adminEmail}"
          "REDIRECT_URL=\"${cfg.redirectUrl}\""
          "ALLOWED_ORIGINS=${lib.concatStringsSep "," cfg.allowedOrigins}"
          "SMTP_HOST=${cfg.smtp.host}"
          "SMTP_PORT=${toString cfg.smtp.port}"
          "SMTP_USER=${cfg.smtp.user}"
          "SMTP_FROM=${cfg.adminEmail}"
        ];

        ExecStart = "${cfg.package}/bin/form-sink";

        Restart = "on-failure";
        RestartSec = 5;
      };
    };
  };
}
