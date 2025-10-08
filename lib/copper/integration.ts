import { CopperContext, CopperActivity } from '@/types';

declare global {
  interface Window {
    Copper: any;
    copperSdk: any;
  }
}

class CopperIntegration {
  private sdk: any = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private context: CopperContext | null = null;

  constructor() {
    // Auto-initialize only when in iframe AND required params exist
    if (typeof window !== 'undefined') {
      try {
        const isInIframe = window.self !== window.top;
        const params = new URLSearchParams(window.location.search);
        const parentOrigin = params.get('parentOrigin') || params.get('origin');
        const hasParams = !!(parentOrigin && params.get('instanceId'));
        
        if (isInIframe && hasParams) {
          this.init();
        }
      } catch {
        // Cross-origin iframe checks might fail, skip initialization
      }
    }
  }

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.isInitialized) {
      return Promise.resolve();
    }

    this.initPromise = new Promise((resolve, reject) => {
      let isInIframe = false;
      try { 
        isInIframe = window.self !== window.top; 
      } catch { 
        isInIframe = true; 
      }
      
      const params = new URLSearchParams(window.location.search);
      const parentOrigin = params.get('parentOrigin') || params.get('origin');
      const hasParams = !!(parentOrigin && params.get('instanceId'));

      if (!isInIframe) {
        console.log('Not in Copper iframe, skipping SDK initialization');
        resolve();
        return;
      }
      
      if (!hasParams) {
        console.warn('Copper SDK initialization skipped: missing origin/instanceId');
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = process.env.NEXT_PUBLIC_COPPER_SDK_URL ||
                   'https://cdn.jsdelivr.net/npm/copper-sdk@latest/dist/copper-sdk.min.js';

      script.onload = () => {
        this.initializeSdk()
          .then(() => resolve())
          .catch(reject);
      };

      script.onerror = () => {
        console.error('Failed to load Copper SDK');
        reject(new Error('Failed to load Copper SDK'));
      };

      document.head.appendChild(script);
    });

    return this.initPromise;
  }

  private async initializeSdk(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 20;

    while (!window.Copper && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.Copper) {
      throw new Error('Copper SDK not available');
    }

    try {
      this.sdk = window.Copper.init();
      this.isInitialized = true;
      console.log('✓ Copper SDK initialized');

      await this.refreshContext();
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize Copper SDK:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.sdk) return;

    this.sdk.on('contextUpdated', async (context: any) => {
      console.log('Copper context updated:', context);
      await this.refreshContext();
    });

    this.sdk.on('navigate', (data: any) => {
      console.log('Copper navigation:', data);
    });
  }

  async getContext(): Promise<CopperContext | null> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.sdk) {
      return null;
    }

    try {
      const data = await this.sdk.getContext();
      
      if (data && data.context && data.context.entity) {
        this.context = {
          type: data.type,
          id: data.context.entity.id,
          name: data.context.entity.name || data.context.entity.company_name,
          email: data.context.entity.email,
          phone: data.context.entity.phone_number,
          customFields: data.context.entity.custom_fields
        };
        return this.context;
      }
    } catch (error) {
      console.error('Failed to get Copper context:', error);
    }

    return null;
  }

  async refreshContext(): Promise<void> {
    await this.getContext();
  }

  async logActivity(activity: CopperActivity): Promise<void> {
    if (!this.sdk) {
      console.error('Copper SDK not initialized');
      return;
    }

    try {
      await this.sdk.logActivity(0, {
        type: activity.type,
        details: activity.details,
        activity_date: activity.date.toISOString(),
        parent: {
          type: activity.parentType,
          id: activity.parentId
        }
      });
      console.log('✓ Activity logged in Copper');
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  isInCopper(): boolean {
    return window.self !== window.top && this.isInitialized;
  }

  getAppLocation(): string {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('location') || 'unknown';
  }
}

export const copperIntegration = new CopperIntegration();
export const isInCopper = () => copperIntegration.isInCopper();
export const getCopperContext = () => copperIntegration.getContext();
export const logCopperActivity = (activity: CopperActivity) => copperIntegration.logActivity(activity);
