import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[ErrorBoundary] Render error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center"
          style={{ background: '#050505', color: '#EDEDED' }}
        >
          <p className="text-sm text-[#9a9a9a]">Что-то пошло не так</p>
          <button
            onClick={this.handleReload}
            className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #5ffbe0, #00F0C0)', color: '#050505' }}
          >
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
