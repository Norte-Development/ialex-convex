import fetch from "node-fetch";
import { config } from "../config";
import { logger } from "../middleware/logging";
import type { SessionState } from "./sessionStore";

/**
 * HTTP client for PJN API calls
 */
export class PjnHttpClient {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = config.pjnApiBaseUrl;
    this.timeout = config.requestTimeoutMs;
  }

  /**
   * Make a request to PJN API with session state
   */
  async request(
    endpoint: string,
    options: {
      method?: string;
      session?: SessionState | null;
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<{
    ok: boolean;
    status: number;
    data?: unknown;
    headers: Headers;
    redirected?: boolean;
    redirectUrl?: string;
  }> {
    const url = `${this.baseUrl}${endpoint}`;
    const method = options.method || "GET";

    // Build headers from session state
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (options.session?.headers) {
      Object.assign(headers, options.session.headers);
    }

    // Add cookies from session state
    if (options.session?.cookies && options.session.cookies.length > 0) {
      headers["Cookie"] = options.session.cookies.join("; ");
    }

    const fetchOptions: Parameters<typeof fetch>[1] = {
      method,
      headers,
      redirect: "manual", // Handle redirects manually to detect auth failures
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check for redirects (likely auth failure)
      if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get("location");
        logger.warn("PJN API redirect detected", {
          endpoint,
          status: response.status,
          redirectUrl,
        });
        return {
          ok: false,
          status: response.status,
          headers: response.headers as unknown as Headers,
          redirected: true,
          redirectUrl: redirectUrl || undefined,
        };
      }

      let data: unknown;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        ok: response.ok,
        status: response.status,
        data,
        headers: response.headers as unknown as Headers,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        logger.error("PJN API request timeout", { endpoint, timeout: this.timeout });
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      logger.error("PJN API request failed", {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Fetch events from PJN API with pagination
   */
  async fetchEvents(
    page: number = 0,
    pageSize: number = config.eventsPageSize,
    session: SessionState | null,
    filters?: {
      categoria?: string;
      fechaDesde?: string;
      fechaHasta?: string;
    }
  ): Promise<{
    events: unknown[];
    hasMore: boolean;
    totalPages?: number;
  }> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (filters?.categoria) {
      params.append("categoria", filters.categoria);
    }
    if (filters?.fechaDesde) {
      params.append("fechaDesde", filters.fechaDesde);
    }
    if (filters?.fechaHasta) {
      params.append("fechaHasta", filters.fechaHasta);
    }

    const endpoint = `${config.pjnEventsEndpoint}?${params.toString()}`;

    const response = await this.request(endpoint, {
      method: "GET",
      session,
    });

    if (!response.ok) {
      if (response.redirected) {
        throw new Error("AUTH_REQUIRED");
      }
      throw new Error(`Failed to fetch events: ${response.status}`);
    }

    // Parse PJN response structure (adjust based on actual API response)
    const data = response.data as {
      eventos?: unknown[];
      total?: number;
      pagina?: number;
      totalPaginas?: number;
      [key: string]: unknown;
    };

    const events = data.eventos || [];
    const totalPages = data.totalPaginas;
    const hasMore =
      totalPages !== undefined ? page + 1 < totalPages : events.length === pageSize;

    return {
      events,
      hasMore,
      totalPages,
    };
  }

  /**
   * Download PDF for an event
   */
  async downloadPdf(
    eventId: string,
    session: SessionState | null
  ): Promise<Buffer | null> {
    const endpoint = config.pjnPdfEndpoint.replace("{eventId}", eventId);

    const response = await this.request(endpoint, {
      method: "GET",
      session,
    });

    if (!response.ok) {
      if (response.redirected) {
        throw new Error("AUTH_REQUIRED");
      }
      logger.warn("Failed to download PDF", {
        eventId,
        status: response.status,
      });
      return null;
    }

    // Check if response is actually a PDF
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("pdf") && !contentType?.includes("application/octet-stream")) {
      logger.warn("Unexpected content type for PDF", {
        eventId,
        contentType,
      });
    }

    // Response data should be a buffer for binary content
    if (Buffer.isBuffer(response.data)) {
      return response.data;
    }

    // If it's a string, try to convert (shouldn't happen for PDFs)
    if (typeof response.data === "string") {
      return Buffer.from(response.data, "binary");
    }

    return null;
  }
}

