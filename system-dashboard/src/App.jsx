import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import DashboardLayout from './components/layout/DashboardLayout';
import Overview from './pages/Overview';
import PlantView from './pages/PlantView';
import Topology from './pages/Topology';
import NodeDetails from './pages/NodeDetails';
import Factors7F from './pages/Factors7F';
import Sensors7S from './pages/Sensors7S';
import Offloading from './pages/Offloading';
import Analytics from './pages/Analytics';
import Tables from './pages/Tables';
import Reports from './pages/Reports';

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/plant" element={<PlantView />} />
            <Route path="/topology" element={<Topology />} />
            <Route path="/node" element={<NodeDetails />} />
            <Route path="/factors" element={<Factors7F />} />
            <Route path="/sensors" element={<Sensors7S />} />
            <Route path="/offloading" element={<Offloading />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/tables" element={<Tables />} />
            <Route path="/reports" element={<Reports />} />
          </Route>
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
