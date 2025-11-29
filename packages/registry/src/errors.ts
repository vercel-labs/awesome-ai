/**
 * Base error class for all agent-related errors
 */
export class AgentError extends Error {
	public readonly code: string
	public readonly details?: Record<string, unknown>

	constructor(
		message: string,
		code: string,
		details?: Record<string, unknown>,
	) {
		super(message)
		this.name = "AgentError"
		this.code = code
		this.details = details
		Error.captureStackTrace?.(this, this.constructor)
	}

	toJSON() {
		return {
			name: this.name,
			code: this.code,
			message: this.message,
			details: this.details,
		}
	}
}

/**
 * Error thrown when API authentication fails
 */
export class AuthenticationError extends AgentError {
	constructor(
		message: string = "Authentication failed. Please check your API key.",
		details?: Record<string, unknown>,
	) {
		super(message, "AUTHENTICATION_ERROR", details)
		this.name = "AuthenticationError"
	}
}

/**
 * Error thrown when rate limits are exceeded
 */
export class RateLimitError extends AgentError {
	public readonly retryAfter?: number

	constructor(
		message: string = "Rate limit exceeded. Please try again later.",
		retryAfter?: number,
		details?: Record<string, unknown>,
	) {
		super(message, "RATE_LIMIT_ERROR", { ...details, retryAfter })
		this.name = "RateLimitError"
		this.retryAfter = retryAfter
	}
}

/**
 * Error thrown when network requests fail
 */
export class NetworkError extends AgentError {
	constructor(
		message: string = "Network request failed. Please check your connection.",
		details?: Record<string, unknown>,
	) {
		super(message, "NETWORK_ERROR", details)
		this.name = "NetworkError"
	}
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends AgentError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, "VALIDATION_ERROR", details)
		this.name = "ValidationError"
	}
}

/**
 * Error thrown when the model returns invalid or unexpected output
 */
export class ModelOutputError extends AgentError {
	constructor(
		message: string = "Model returned invalid output.",
		details?: Record<string, unknown>,
	) {
		super(message, "MODEL_OUTPUT_ERROR", details)
		this.name = "ModelOutputError"
	}
}

/**
 * Error thrown when a request times out
 */
export class TimeoutError extends AgentError {
	constructor(
		message: string = "Request timed out.",
		details?: Record<string, unknown>,
	) {
		super(message, "TIMEOUT_ERROR", details)
		this.name = "TimeoutError"
	}
}

/**
 * Error thrown when the request is aborted/cancelled
 */
export class AbortError extends AgentError {
	constructor(
		message: string = "Request was aborted.",
		details?: Record<string, unknown>,
	) {
		super(message, "ABORT_ERROR", details)
		this.name = "AbortError"
	}
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends AgentError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, "CONFIGURATION_ERROR", details)
		this.name = "ConfigurationError"
	}
}

/**
 * Parse and classify errors from the AI SDK
 */
export function parseAISDKError(error: unknown): AgentError {
	if (error instanceof AgentError) {
		return error
	}

	if (error instanceof Error) {
		const message = error.message.toLowerCase()

		if (
			message.includes("api key") ||
			message.includes("authentication") ||
			message.includes("unauthorized")
		) {
			return new AuthenticationError(error.message, {
				originalError: error.name,
			})
		}

		if (
			message.includes("rate limit") ||
			message.includes("too many requests") ||
			message.includes("quota")
		) {
			const retryAfterMatch = error.message.match(/retry after (\d+)/i)
			const retryAfter = retryAfterMatch?.[1]
				? parseInt(retryAfterMatch[1], 10)
				: undefined
			return new RateLimitError(error.message, retryAfter, {
				originalError: error.name,
			})
		}

		if (
			message.includes("network") ||
			message.includes("fetch failed") ||
			message.includes("econnrefused") ||
			message.includes("enotfound")
		) {
			return new NetworkError(error.message, { originalError: error.name })
		}

		if (message.includes("timeout") || message.includes("timed out")) {
			return new TimeoutError(error.message, { originalError: error.name })
		}

		if (message.includes("abort") || message.includes("cancelled")) {
			return new AbortError(error.message, { originalError: error.name })
		}

		if (message.includes("invalid") || message.includes("malformed")) {
			return new ModelOutputError(error.message, { originalError: error.name })
		}

		return new AgentError(error.message, "UNKNOWN_ERROR", {
			originalError: error.name,
			stack: error.stack,
		})
	}

	return new AgentError(
		typeof error === "string" ? error : "An unknown error occurred",
		"UNKNOWN_ERROR",
		{ error: String(error) },
	)
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
	if (error instanceof RateLimitError) return true
	if (error instanceof NetworkError) return true
	if (error instanceof TimeoutError) return true

	if (error instanceof AgentError) {
		return false
	}

	if (error instanceof Error) {
		const message = error.message.toLowerCase()
		return (
			message.includes("network") ||
			message.includes("timeout") ||
			message.includes("rate limit") ||
			message.includes("econnrefused") ||
			message.includes("enotfound")
		)
	}

	return false
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(
	attempt: number,
	baseDelay: number = 1000,
	maxDelay: number = 30000,
): number {
	const delay = Math.min(baseDelay * 2 ** attempt, maxDelay)
	const jitter = delay * 0.1 * Math.random()
	return Math.floor(delay + jitter)
}
