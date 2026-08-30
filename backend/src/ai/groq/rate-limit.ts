import Groq from "groq-sdk";

/**
 * ============================================================
 * TYPES
 * ============================================================
 */

export interface GroqRetryOptions {
  maxRetries?: number;

  maxRetryDelayMs?: number;

  baseDelayMs?: number;
}

interface ParsedRateLimitError {
  isRateLimit: boolean;

  status?: number;

  message: string;

  retryAfterMs?: number;

  quotaType?:
    | "TPM"
    | "TPD"
    | "RPM"
    | "RPD"
    | "REQUEST"
    | "UNKNOWN";
}

/**
 * ============================================================
 * SLEEP
 * ============================================================
 */

export function sleep(
  ms: number
): Promise<void> {
  return new Promise(
    (
      resolve
    ) => {
      setTimeout(
        resolve,
        ms
      );
    }
  );
}

/**
 * ============================================================
 * ERROR STATUS
 * ============================================================
 */

function getErrorStatus(
  error: unknown
): number | undefined {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return undefined;
  }

  const candidate =
    error as {
      status?: unknown;

      response?: {
        status?: unknown;
      };
    };

  if (
    typeof candidate.status ===
    "number"
  ) {
    return candidate.status;
  }

  if (
    typeof candidate.response?.status ===
    "number"
  ) {
    return candidate.response.status;
  }

  return undefined;
}

/**
 * ============================================================
 * ERROR MESSAGE
 * ============================================================
 */

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    typeof error === "string"
  ) {
    return error;
  }

  try {
    return JSON.stringify(
      error
    );
  } catch {
    return String(
      error
    );
  }
}

/**
 * ============================================================
 * RATE LIMIT PARSER
 * ============================================================
 */

function parseRateLimitError(
  error: unknown
): ParsedRateLimitError {
  const status =
    getErrorStatus(
      error
    );

  const message =
    getErrorMessage(
      error
    );

  const lower =
    message.toLowerCase();

  const isRateLimit =
    status === 429 ||
    lower.includes(
      "rate limit"
    ) ||
    lower.includes(
      "rate_limit_exceeded"
    ) ||
    lower.includes(
      "tokens per day"
    ) ||
    lower.includes(
      "tokens per minute"
    ) ||
    lower.includes(
      "quota"
    ) ||
    lower.includes(
      "resource_exhausted"
    );

  if (
    !isRateLimit
  ) {
    return {
      isRateLimit: false,

      status,

      message,
    };
  }

  let retryAfterMs:
    | number
    | undefined;

  /**
   * Examples:
   *
   * retry in 31.84s
   * try again in 5s
   * retry-after 10s
   */
  const secondsMatch =
    message.match(
      /(?:retry in|try again in|retry-after|delay(?: of)?|wait(?: for)?)\s*([0-9]+(?:\.[0-9]+)?)\s*s/i
    );

  if (
    secondsMatch
  ) {
    const seconds =
      Number(
        secondsMatch[1]
      );

    if (
      Number.isFinite(
        seconds
      )
    ) {
      retryAfterMs =
        seconds * 1000;
    }
  }

  /**
   * Example:
   *
   * 35m9.456s
   */
  if (
    retryAfterMs ===
    undefined
  ) {
    const minuteSecondMatch =
      message.match(
        /([0-9]+)\s*m\s*([0-9]+(?:\.[0-9]+)?)\s*s/i
      );

    if (
      minuteSecondMatch
    ) {
      const minutes =
        Number(
          minuteSecondMatch[1]
        );

      const seconds =
        Number(
          minuteSecondMatch[2]
        );

      if (
        Number.isFinite(
          minutes
        ) &&
        Number.isFinite(
          seconds
        )
      ) {
        retryAfterMs =
          (
            minutes * 60 +
            seconds
          ) * 1000;
      }
    }
  }

  /**
   * HTTP Retry-After header.
   */
  const candidate =
    error as {
      headers?: Headers;
    };

  const headers =
    candidate?.headers;

  if (
    retryAfterMs ===
      undefined &&
    headers
  ) {
    const retryAfter =
      headers.get(
        "retry-after"
      );

    if (
      retryAfter
    ) {
      const value =
        Number(
          retryAfter
        );

      if (
        Number.isFinite(
          value
        )
      ) {
        retryAfterMs =
          value * 1000;
      }
    }
  }

  let quotaType:
    | ParsedRateLimitError["quotaType"]
    | undefined =
    "UNKNOWN";

  if (
    lower.includes(
      "tokens per day"
    ) ||
    lower.includes(
      "tpd"
    )
  ) {
    quotaType =
      "TPD";
  } else if (
    lower.includes(
      "tokens per minute"
    ) ||
    lower.includes(
      "tpm"
    )
  ) {
    quotaType =
      "TPM";
  } else if (
    lower.includes(
      "requests per minute"
    ) ||
    lower.includes(
      "rpm"
    )
  ) {
    quotaType =
      "RPM";
  } else if (
    lower.includes(
      "requests per day"
    ) ||
    lower.includes(
      "rpd"
    )
  ) {
    quotaType =
      "RPD";
  } else if (
    lower.includes(
      "request"
    )
  ) {
    quotaType =
      "REQUEST";
  }

  return {
    isRateLimit: true,

    status,

    message,

    retryAfterMs,

    quotaType,
  };
}

/**
 * ============================================================
 * PUBLIC RATE LIMIT CHECK
 * ============================================================
 */

export function isGroqRateLimitError(
  error: unknown
): boolean {
  return parseRateLimitError(
    error
  ).isRateLimit;
}

/**
 * ============================================================
 * SHOULD RETRY
 * ============================================================
 */

function shouldRetryError(
  error: unknown
): boolean {
  const status =
    getErrorStatus(
      error
    );

  /**
   * Groq rate limit.
   */
  if (
    status === 429 ||
    isGroqRateLimitError(
      error
    )
  ) {
    return true;
  }

  /**
   * Temporary HTTP failures.
   */
  if (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  const message =
    getErrorMessage(
      error
    ).toLowerCase();

  return (
    message.includes(
      "timeout"
    ) ||
    message.includes(
      "timed out"
    ) ||
    message.includes(
      "connection reset"
    ) ||
    message.includes(
      "connection error"
    ) ||
    message.includes(
      "network error"
    ) ||
    message.includes(
      "socket hang up"
    )
  );
}

/**
 * ============================================================
 * RETRY DELAY
 * ============================================================
 */

function calculateRetryDelay(
  error: unknown,
  attempt: number,
  baseDelayMs: number
): number {
  const parsed =
    parseRateLimitError(
      error
    );

  if (
    parsed.retryAfterMs !==
      undefined &&
    Number.isFinite(
      parsed.retryAfterMs
    )
  ) {
    return Math.max(
      0,
      parsed.retryAfterMs
    );
  }

  const exponential =
    baseDelayMs *
    Math.pow(
      2,
      attempt
    );

  const jitter =
    Math.floor(
      Math.random() * 500
    );

  return (
    exponential +
    jitter
  );
}

/**
 * ============================================================
 * RATE LIMIT ERROR
 * ============================================================
 */

function createRateLimitError(
  parsed: ParsedRateLimitError,
  maxRetryDelayMs: number
): Error {
  const requestedDelay =
    parsed.retryAfterMs ?? 0;

  const requestedSeconds =
    requestedDelay / 1000;

  const maxSeconds =
    maxRetryDelayMs / 1000;

  if (
    requestedDelay >
    maxRetryDelayMs
  ) {
    return new Error(
      [
        "Groq rate limit requires a longer wait.",
        `Server requested approximately ${Math.ceil(
          requestedSeconds
        )} seconds.`,
        `Automatic retry limit is ${Math.ceil(
          maxSeconds
        )} seconds.`,
        `Original error: ${parsed.message}`,
      ].join(" ")
    );
  }

  return new Error(
    [
      "Groq rate limit reached.",
      parsed.retryAfterMs
        ? `Retry after approximately ${Math.ceil(
            requestedSeconds
          )} seconds.`
        : "Retry delay was not provided.",
      `Original error: ${parsed.message}`,
    ].join(" ")
  );
}

/**
 * ============================================================
 * WITH GROQ RETRY
 * ============================================================
 */

export async function withGroqRetry<
  T
>(
  operation: () => Promise<T>,
  options: GroqRetryOptions = {}
): Promise<T> {
  const maxRetries =
    options.maxRetries ?? 2;

  const maxRetryDelayMs =
    options.maxRetryDelayMs ??
    30_000;

  const baseDelayMs =
    options.baseDelayMs ??
    2_000;

  let lastError:
    | unknown
    | undefined;

  for (
    let attempt = 0;
    attempt <= maxRetries;
    attempt += 1
  ) {
    try {
      return await operation();
    } catch (
      error
    ) {
      lastError =
        error;

      if (
        !shouldRetryError(
          error
        )
      ) {
        throw error;
      }

      const parsed =
        parseRateLimitError(
          error
        );

      /**
       * --------------------------------------------------------
       * RATE LIMIT
       * --------------------------------------------------------
       */

      if (
        parsed.isRateLimit
      ) {
        const delay =
          calculateRetryDelay(
            error,
            attempt,
            baseDelayMs
          );

        if (
          delay >
          maxRetryDelayMs
        ) {
          throw createRateLimitError(
            parsed,
            maxRetryDelayMs
          );
        }

        if (
          attempt >=
          maxRetries
        ) {
          throw new Error(
            [
              "Groq request failed after automatic retries.",
              `Retries attempted: ${maxRetries}.`,
              parsed.message,
            ].join(" ")
          );
        }

        console.warn(
          `[Groq Retry] Rate limit detected. Retrying in ${Math.ceil(
            delay / 1000
          )} seconds...`
        );

        await sleep(
          delay
        );

        continue;
      }

      /**
       * --------------------------------------------------------
       * TEMPORARY SERVER / NETWORK FAILURE
       * --------------------------------------------------------
       */

      if (
        attempt >=
        maxRetries
      ) {
        throw error;
      }

      const delay =
        Math.min(
          calculateRetryDelay(
            error,
            attempt,
            baseDelayMs
          ),
          maxRetryDelayMs
        );

      console.warn(
        `[Groq Retry] Temporary failure. Retrying in ${Math.ceil(
          delay / 1000
        )} seconds...`
      );

      await sleep(
        delay
      );
    }
  }

  throw (
    lastError ??
    new Error(
      "Groq request failed."
    )
  );
}

/**
 * ============================================================
 * SAFE RETRY
 * ============================================================
 */

export async function withGroqSafeRetry<
  T
>(
  operation: () => Promise<T>
): Promise<T> {
  return withGroqRetry(
    operation,
    {
      maxRetries: 2,

      maxRetryDelayMs:
        30_000,

      baseDelayMs:
        2_000,
    }
  );
}

/**
 * ============================================================
 * GROQ CLIENT HELPER
 * ============================================================
 */

export function createGroqClient(): Groq {
  const apiKey =
    process.env.GROQ_API_KEY;

  if (
    !apiKey ||
    !apiKey.trim()
  ) {
    throw new Error(
      "GROQ_API_KEY is not configured."
    );
  }

  return new Groq({
    apiKey,
  });
}