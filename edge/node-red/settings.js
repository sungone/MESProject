module.exports = {
    flowFile: process.env.FLOWS || "flows.json",
    uiPort: process.env.PORT || 1880,
    credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET || "mes-edge-dev-secret-change-me",
    contextStorage: {
        default: {
            module: "localfilesystem"
        }
    },
    editorTheme: {
        projects: {
            enabled: false
        }
    },
    functionExternalModules: false,
    logging: {
        console: {
            level: "info",
            metrics: false,
            audit: false
        }
    }
};
