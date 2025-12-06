type RetryCallback<T> = () => Promise<T>;

class NetworkService {
  private online: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupListeners();
    }
  }

  private setupListeners(): void {
    window.addEventListener('online', () => {
      this.online = true;
    });

    window.addEventListener('offline', () => {
      this.online = false;
    });
  }

  isOnline(): boolean {
    return this.online;
  }

  async retry<T>(
    callback: RetryCallback<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    exponentialBackoff: boolean = true
  ): Promise<T> {
    let retries = 0;
    let currentDelay = delay;

    while (retries < maxRetries) {
      try {
        return await callback();
      } catch (error) {
        retries++;
        
        if (retries >= maxRetries) {
          throw error;
        }
        
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        
        // Exponential backoff
        if (exponentialBackoff) {
          currentDelay *= 2;
        }
      }
    }

    throw new Error('Max retries exceeded');
  }

  async poll<T>(
    callback: RetryCallback<T>,
    predicate: (result: T) => boolean,
    interval: number = 2000,
    timeout: number = 60000
  ): Promise<T> {
    const startTime = Date.now();
    let result: T;

    while (Date.now() - startTime < timeout) {
      result = await callback();
      
      if (predicate(result)) {
        return result;
      }
      
      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error('Polling timeout exceeded');
  }
}

export const networkService = new NetworkService();
