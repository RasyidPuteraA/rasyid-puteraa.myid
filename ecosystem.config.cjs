module.exports = {
  apps: [
    {
      name: "rasyid-puteraa",
      script: "./server.js",
      cwd: "/var/www/rasyid-puteraa/current",
      env_file: "/var/www/rasyid-puteraa/shared/.env",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "4100"
      },
      max_restarts: 10,
      restart_delay: 2000,
      out_file: "/var/www/rasyid-puteraa/shared/logs/out.log",
      error_file: "/var/www/rasyid-puteraa/shared/logs/error.log",
      merge_logs: true,
      time: true
    }
  ]
};
