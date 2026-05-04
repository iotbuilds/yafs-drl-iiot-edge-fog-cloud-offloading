import { Link } from 'react-router-dom';

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <p className="text-sm text-muted-foreground">This dashboard page does not exist.</p>
        <Link className="text-sm font-medium text-primary hover:underline" to="/">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
