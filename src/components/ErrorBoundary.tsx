import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Without this, any render-time throw unmounts the whole React root and the
 * user just sees a white page with nothing to report.
 */
export class ErrorBoundary extends Component<
  Readonly<ErrorBoundaryProps>,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error('Unhandled render error', error, info);
  }

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl rounded-md border border-red-200 bg-white p-5">
          <h1 className="text-lg font-semibold text-red-700">
            Something failed while rendering this page
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            The details below identify the cause. Reloading may clear it if the
            failure was transient.
          </p>

          <pre className="mt-4 overflow-auto rounded bg-gray-900 p-3 text-xs leading-relaxed text-gray-100">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
            {componentStack ? `\n\nComponent stack:${componentStack}` : ''}
          </pre>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/';
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Back to data
            </button>
          </div>
        </div>
      </div>
    );
  }
}
