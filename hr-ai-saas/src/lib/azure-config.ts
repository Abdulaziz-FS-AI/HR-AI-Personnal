import { DefaultAzureCredential, AzureCliCredential, ManagedIdentityCredential } from '@azure/identity';
import { AppConfigurationClient } from '@azure/app-configuration';
import { SecretClient } from '@azure/keyvault-secrets';

interface ConfigValue {
  key: string;
  value: string;
  isSecret: boolean;
}

export class AzureConfigManager {
  private credential: any;
  private client: AppConfigurationClient | null = null;
  private configCache: Record<string, string> = {};
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeCredential();
  }

  private initializeCredential() {
    if (process.env.NODE_ENV === 'development') {
      // For local development, use Azure CLI credentials
      this.credential = new AzureCliCredential();
    } else {
      // For production, use Managed Identity
      const clientId = process.env.AZURE_CLIENT_ID;
      if (clientId) {
        this.credential = new ManagedIdentityCredential(clientId);
      } else {
        this.credential = new DefaultAzureCredential();
      }
    }
  }

  private getAppConfigClient(): AppConfigurationClient {
    if (!this.client) {
      const endpoint = process.env.AZURE_APP_CONFIG_ENDPOINT;
      if (!endpoint) {
        throw new Error('AZURE_APP_CONFIG_ENDPOINT is required');
      }
      this.client = new AppConfigurationClient(endpoint, this.credential);
    }
    return this.client;
  }

  private async getKeyVaultSecret(keyVaultRef: string): Promise<string> {
    try {
      const ref = JSON.parse(keyVaultRef);
      const vaultUrl = ref.uri.split('/secrets/')[0];
      const secretName = ref.uri.split('/secrets/')[1].split('/')[0];
      
      const secretClient = new SecretClient(vaultUrl, this.credential);
      const secret = await secretClient.getSecret(secretName);
      return secret.value || '';
    } catch (error) {
      console.error(`Failed to retrieve Key Vault secret:`, error);
      throw error;
    }
  }

  private isCacheValid(): boolean {
    return Date.now() < this.cacheExpiry;
  }

  async loadConfiguration(label?: string): Promise<Record<string, string>> {
    // Return cached config if still valid
    if (this.isCacheValid() && Object.keys(this.configCache).length > 0) {
      return this.configCache;
    }

    try {
      const client = this.getAppConfigClient();
      const version = label || process.env.APP_VERSION || 'current';
      
      console.log(`Loading configuration with label: ${version}`);

      const settings = client.listConfigurationSettings({
        labelFilter: version
      });

      const config: Record<string, string> = {};
      const secretPromises: Promise<void>[] = [];

      for await (const setting of settings) {
        if (!setting.key || setting.value === undefined) continue;

        // Check if this is a Key Vault reference
        if (setting.contentType?.includes('keyvaultref')) {
          // Handle Key Vault references asynchronously
          const promise = this.getKeyVaultSecret(setting.value)
            .then(secretValue => {
              config[setting.key!] = secretValue;
            })
            .catch(error => {
              console.error(`Failed to load secret for key ${setting.key}:`, error);
              // Don't fail the entire config load for one secret
            });
          secretPromises.push(promise);
        } else {
          // Regular configuration value
          config[setting.key] = setting.value;
        }
      }

      // Wait for all Key Vault secrets to load
      await Promise.all(secretPromises);

      // Update cache
      this.configCache = config;
      this.cacheExpiry = Date.now() + this.CACHE_DURATION;

      console.log(`Loaded ${Object.keys(config).length} configuration settings`);
      return config;

    } catch (error) {
      console.error('Failed to load Azure App Configuration:', error);
      
      // Fallback to environment variables if App Config fails
      console.log('Falling back to environment variables');
      return this.getFallbackConfig();
    }
  }

  private getFallbackConfig(): Record<string, string> {
    // Return current environment variables as fallback
    const config: Record<string, string> = {};
    
    // Map critical environment variables
    const criticalVars = [
      'AZURE_SQL_SERVER',
      'AZURE_SQL_DATABASE', 
      'AZURE_SQL_USER',
      'AZURE_SQL_PASSWORD',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
      'HYPERBOLIC_API_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'AZURE_STORAGE_CONNECTION_STRING',
      'AZURE_STORAGE_ACCOUNT_NAME',
      'AZURE_STORAGE_ACCOUNT_KEY'
    ];

    for (const varName of criticalVars) {
      const value = process.env[varName];
      if (value) {
        config[varName] = value;
      }
    }

    return config;
  }

  async getSecret(key: string): Promise<string | null> {
    const config = await this.loadConfiguration();
    return config[key] || null;
  }

  async refreshConfiguration(): Promise<Record<string, string>> {
    // Force refresh by clearing cache
    this.configCache = {};
    this.cacheExpiry = 0;
    return this.loadConfiguration();
  }

  // Get public (non-secret) configuration for client-side use
  async getPublicConfiguration(): Promise<Record<string, string>> {
    const config = await this.loadConfiguration();
    
    // Filter out sensitive keys
    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'connectionstring'];
    const publicConfig: Record<string, string> = {};

    for (const [key, value] of Object.entries(config)) {
      const keyLower = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => keyLower.includes(sensitive));
      
      if (!isSensitive) {
        publicConfig[key] = value;
      }
    }

    return publicConfig;
  }

  // Health check method
  async isHealthy(): Promise<boolean> {
    try {
      const client = this.getAppConfigClient();
      
      // Try to list one configuration setting
      const settings = client.listConfigurationSettings({
        keyFilter: '*',
        pageSize: 1
      });
      
      for await (const setting of settings) {
        // If we can read at least one setting, we're healthy
        return true;
      }
      
      return true; // Empty config store is still healthy
    } catch (error) {
      console.error('Azure App Configuration health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
let configManager: AzureConfigManager | null = null;

export function getConfigManager(): AzureConfigManager {
  if (!configManager) {
    configManager = new AzureConfigManager();
  }
  return configManager;
}

// Helper function to get configuration in API routes
export async function getAzureConfig(): Promise<Record<string, string>> {
  const manager = getConfigManager();
  return manager.loadConfiguration();
}

// Helper function to get a specific secret
export async function getAzureSecret(key: string): Promise<string | null> {
  const manager = getConfigManager();
  return manager.getSecret(key);
}