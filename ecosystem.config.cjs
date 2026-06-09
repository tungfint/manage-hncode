module.exports = {
  apps: [
    {
      name: "manage-hncode",
      script: "npm",
      args: "run start -- -p 3000",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "768M",
      time: true,
    },
  ],
};
