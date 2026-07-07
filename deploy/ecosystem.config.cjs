module.exports = {
  apps: [
    {
      name: "benmingmao-h5",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3100",
      cwd: "/var/www/benmingmao-h5",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "700M",
      error_file: "/var/log/benmingmao-h5/error.log",
      out_file: "/var/log/benmingmao-h5/out.log",
      time: true,
    },
  ],
};
