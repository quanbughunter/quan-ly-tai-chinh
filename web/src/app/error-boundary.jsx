import { Component } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Card } from '@/components/ui/card.jsx';
import { errMsg } from '@/lib/format.js';

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error(error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Card className="mx-auto mt-6 max-w-md p-6 text-center">
        <span className="mx-auto mb-3 grid size-12 place-content-center rounded-2xl bg-destructive/12 text-destructive"><TriangleAlert className="size-6" /></span>
        <h2 className="text-lg font-bold">Có lỗi khi hiển thị màn hình</h2>
        <p className="mt-1 text-sm text-muted-foreground">{errMsg(this.state.error)}</p>
        <a href="#/" onClick={() => this.setState({ error: null })} className="mt-4 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Về Tổng quan</a>
      </Card>
    );
  }
}
