import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  CreditCard, 
  Package, 
  History, 
  Plus, 
  Trash2, 
  TrendingUp, 
  X,
  Smartphone,
  Laptop,
  Monitor,
  Watch,
  Box,
  Check,
  Cpu,
  User,
  Minus,
  Inbox,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';

// --- Types & Constants ---
type DeviceCategory = 'Smartphone' | 'Laptop' | 'Tablet' | 'Watch' | 'Router' | 'Accessory' | 'Other';

interface Product {
  id: string;
  name: string;
  category: DeviceCategory;
  price: number;
  stock: number;
  dateAdded: number;
}

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  category?: DeviceCategory;
}

interface Sale {
  id: string;
  customerName: string;
  customerPhone: string;
  items: SaleItem[];
  totalPrice: number;
  paymentAmount: number;
  timestamp: number;
}

interface DamageRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  type: 'Damaged' | 'Stolen';
  note?: string | undefined;
  timestamp: number;
}

type IconType = React.ComponentType<any>;

const CATEGORY_MAP: Record<DeviceCategory, { icon: IconType; color: string; hex: string }> = {
  Smartphone: { icon: Smartphone, color: 'bg-blue-500', hex: '#3b82f6' },
  Laptop: { icon: Laptop, color: 'bg-indigo-500', hex: '#6366f1' },
  Tablet: { icon: Monitor, color: 'bg-purple-500', hex: '#a855f7' },
  Watch: { icon: Watch, color: 'bg-rose-500', hex: '#f43f5e' },
  Router: { icon: Box, color: 'bg-cyan-500', hex: '#06b6d4' },
  Accessory: { icon: Box, color: 'bg-amber-500', hex: '#f59e0b' },
  Other: { icon: Box, color: 'bg-slate-500', hex: '#64748b' }
};

const STORAGE_KEY = 'nextgen_device_manager_v1';

const formatNaira = (amount: number) => {
  return '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 2 });
};

const escapeCSV = (value: string | number | null | undefined) => {
  const v = value == null ? '' : String(value);
  return '"' + v.replace(/"/g, '""') + '"';
};

export default function App() {
  const [view, setView] = useState<'dashboard' | 'inventory' | 'payments' | 'history'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [damages, setDamages] = useState<DamageRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Persistence logic
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.products)) setProducts(parsed.products);
        if (Array.isArray(parsed.sales)) setSales(parsed.sales);
        if (Array.isArray(parsed.damages)) setDamages(parsed.damages);
      } catch (e) {
        console.error('Failed to load local data', e);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return; // avoid overwriting saved data before hydration
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, sales, damages }));
  }, [products, sales, damages, hydrated]);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Analytics derived from state
  const analytics = useMemo(() => {
    const damageLoss = damages.reduce((acc, d) => acc + d.unitPrice * d.quantity, 0);
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.paymentAmount, 0) - damageLoss;
    const stockValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);

    const categoryDistribution: Record<string, number> = {};
    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        const cat = item.category || 'Other';
        categoryDistribution[cat] = (categoryDistribution[cat] || 0) + item.quantity;
      });
    });

    const chartData = Object.entries(categoryDistribution).map(([label, value]) => ({
      label,
      value,
      color: CATEGORY_MAP[(label as DeviceCategory)]?.hex || '#64748b'
    }));

    return { totalRevenue, totalSales: sales.length, stockValue, chartData, damageLoss };
  }, [sales, products, damages]);

  // Actions
  const addProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const category = (fd.get('category') as string) as DeviceCategory;
    const newP: Product = {
      id: crypto.randomUUID(),
      name: (fd.get('name') as string) || 'Untitled',
      category,
      price: Number(fd.get('price')) || 0,
      stock: Number(fd.get('stock')) || 0,
      dateAdded: Date.now()
    };
    setProducts((prev) => [newP, ...prev]);
    setIsAddModalOpen(false);
    notify(`${newP.name} added to inventory`);
  };

  const processSale = (saleData: Omit<Sale, 'id' | 'timestamp'>) => {
    // Validate stock availability
    const insufficient = saleData.items.find((it) => {
      const p = products.find((prod) => prod.id === it.productId);
      return !p || p.stock < it.quantity;
    });
    if (insufficient) {
      notify('Insufficient stock for one or more items');
      return;
    }

    const newSale: Sale = {
      ...saleData,
      id: `TXN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      timestamp: Date.now()
    };

    setSales((prev) => [newSale, ...prev]);
    // Sync Inventory
    setProducts((prev) =>
      prev.map((p) => {
        const sold = saleData.items.find((si) => si.productId === p.id);
        return sold ? { ...p, stock: Math.max(0, p.stock - sold.quantity) } : p;
      })
    );

    setView('history');
    notify(`Transaction ${newSale.id} completed`);
  };

  const recordDamage = (payload: { productId: string; quantity: number; type: DamageRecord['type']; note?: string }) => {
    const product = products.find((p) => p.id === payload.productId);
    if (!product) {
      notify('Product not found');
      return;
    }
    if (payload.quantity <= 0) {
      notify('Quantity must be greater than zero');
      return;
    }
    if (product.stock < payload.quantity) {
      notify('Cannot log more than available stock');
      return;
    }

    const record: DamageRecord = {
      id: `DMG-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      productId: product.id,
      productName: product.name,
      quantity: payload.quantity,
      unitPrice: product.price,
      type: payload.type,
      note: payload.note?.trim() || undefined,
      timestamp: Date.now()
    };

    setDamages((prev) => [record, ...prev]);
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, stock: Math.max(0, p.stock - payload.quantity) } : p))
    );
    notify(`${payload.type} logged for ${product.name}`);
  };

  const exportCSV = () => {
    if (sales.length === 0) return notify('No records to export');
    const headers = ['ID', 'Date', 'Customer', 'Phone', 'Items', 'Amount'];
    const rows = sales.map((s) => [
      s.id,
      new Date(s.timestamp).toLocaleDateString(),
      s.customerName,
      s.customerPhone,
      s.items.map((i) => `${i.quantity}x ${i.productName}`).join('; '),
      s.paymentAmount
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((c) => escapeCSV(c)).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sales_Report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // revoke after use
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('CSV Export Started');
  };

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] text-slate-900">
      {/* Sidebar Navigation */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-white border-r border-slate-200 hidden lg:flex flex-col fixed inset-y-0 transition-all duration-300 z-50`}>
        <div className="p-4 flex flex-col h-full">
          <div className={`flex items-center mb-10 h-12 ${isSidebarCollapsed ? 'justify-center' : 'px-4'}`}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-200">
              <Cpu className="text-white" size={20} />
            </div>
            {!isSidebarCollapsed && <h1 className="ml-3 text-xl font-bold tracking-tight">DevicePay</h1>}
          </div>

          <nav className="flex-1 space-y-2">
            <NavItem icon={LayoutDashboard} label="Dashboard" active={view === 'dashboard'} collapsed={isSidebarCollapsed} onClick={() => setView('dashboard')} />
            <NavItem icon={Package} label="Inventory" active={view === 'inventory'} collapsed={isSidebarCollapsed} onClick={() => setView('inventory')} />
            <NavItem icon={CreditCard} label="New Payment" active={view === 'payments'} collapsed={isSidebarCollapsed} onClick={() => setView('payments')} />
            <NavItem icon={History} label="History" active={view === 'history'} collapsed={isSidebarCollapsed} onClick={() => setView('history')} />
          </nav>

          <div className="mt-auto pt-4 border-t border-slate-100 flex justify-center">
            <button 
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              aria-label="Toggle sidebar"
              className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all border border-slate-200/50"
            >
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        <header className="sticky top-0 z-40 bg-[#F9FAFB]/80 backdrop-blur-md border-b border-slate-200 px-8 py-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold capitalize">{view}</h2>
          <div className="flex gap-3">
            {view === 'history' && (
              <button type="button" onClick={exportCSV} className="px-5 py-2.5 border border-slate-200 bg-white rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-slate-50">
                <Download size={16} /> Export CSV
              </button>
            )}
            <button type="button" onClick={() => setIsAddModalOpen(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-100 hover:bg-indigo-700">
              <Plus size={16} /> Add Device
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {view === 'dashboard' && <Dashboard analytics={analytics} sales={sales} />}
          {view === 'inventory' && <Inventory products={products} setProducts={setProducts} />}
          {view === 'payments' && (
            <PaymentPortal
              products={products}
              damages={damages}
              onComplete={processSale}
              onLogDamage={recordDamage}
              onNotify={notify}
            />
          )}
          {view === 'history' && <HistoryTable sales={sales} />}
        </div>
      </main>

      {/* Notifications */}
      {notification && (
        <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-bottom-4">
          <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <Check size={18} className="text-emerald-400" />
            <span className="font-semibold">{notification}</span>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">New Inventory Item</h3>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={addProduct} className="p-8 space-y-5">
              <input required name="name" className="w-full px-5 py-3.5 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Product Name" />
              <select name="category" className="w-full px-5 py-3.5 bg-slate-50 border rounded-2xl outline-none appearance-none">
                {(Object.keys(CATEGORY_MAP) as DeviceCategory[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <input required name="stock" type="number" className="w-full px-5 py-3.5 bg-slate-50 border rounded-2xl outline-none" placeholder="Stock" />
                <input required name="price" type="number" className="w-full px-5 py-3.5 bg-slate-50 border rounded-2xl outline-none" placeholder="Price (₦)" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold">Save Item</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components
interface NavItemProps {
  icon: IconType;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

function NavItem({ icon: Icon, label, active, collapsed, onClick }: NavItemProps) {
  return (
    <button 
      type="button"
      onClick={onClick} 
      className={`w-full flex items-center rounded-2xl transition-all ${active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'} ${collapsed ? 'justify-center p-3' : 'px-4 py-3 gap-4'}`}
      title={collapsed ? label : ''}
      aria-pressed={active}
    >
      <Icon size={20} className={active ? 'text-indigo-400' : 'text-slate-400'} />
      {!collapsed && <span className="font-bold text-sm">{label}</span>}
    </button>
  );
}

function Dashboard({ analytics, sales }: { analytics: any; sales: Sale[] }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Revenue" value={formatNaira(analytics.totalRevenue)} icon={TrendingUp} color="bg-indigo-600" />
        <StatCard label="Sales Count" value={analytics.totalSales} icon={CreditCard} color="bg-emerald-600" />
        <StatCard label="Stock Value" value={formatNaira(analytics.stockValue)} icon={Package} color="bg-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200">
          <h3 className="font-bold mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {sales.slice(0, 5).map((s: Sale) => (
              <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-100"><User size={16} /></div>
                  <div>
                    <p className="text-sm font-bold">{s.customerName}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(s.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
                <p className="font-black text-sm">{formatNaira(s.paymentAmount)}</p>
              </div>
            ))}
            {sales.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">No transactions yet</div>}
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 flex flex-col items-center justify-center">
           <h3 className="font-bold mb-8 w-full">Category Sales</h3>
           {analytics.chartData.length > 0 ? (
             <div className="flex flex-col items-center gap-6">
                <div className="relative w-40 h-40">
                   <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                     <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F1F5F9" strokeWidth="12" />
                     {analytics.chartData.map((d: any, i: number) => (
                        <circle key={d.label || i} cx="50" cy="50" r="40" fill="transparent" stroke={d.color} strokeWidth="12" strokeDasharray="100 100" />
                     ))}
                     <circle cx="50" cy="50" r="30" fill="white" />
                   </svg>
                   <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-black">{analytics.totalSales}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                   {analytics.chartData.map((d: any, i: number) => (
                      <div key={d.label} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}} />
                        <span className="font-bold text-slate-600">{d.label}</span>
                      </div>
                   ))}
                </div>
             </div>
           ) : <p className="text-slate-400 text-sm">No sales data</p>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 flex items-center gap-6 shadow-sm">
      <div className={`w-14 h-14 rounded-2xl ${color} text-white flex items-center justify-center shadow-lg shadow-indigo-100`}><Icon size={24} /></div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
        <h3 className="text-2xl font-black">{value}</h3>
      </div>
    </div>
  );
}

function Inventory({ products, setProducts }: { products: Product[]; setProducts: (p: Product[] | ((prev: Product[]) => Product[])) => void; }) {
  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
          <tr>
            <th className="px-8 py-5">Product</th>
            <th className="px-8 py-5 text-center">Stock</th>
            <th className="px-8 py-5 text-right">Unit Price</th>
            <th className="px-8 py-5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {products.map((p: Product) => (
            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-8 py-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-opacity-10 ${CATEGORY_MAP[p.category].color} ${CATEGORY_MAP[p.category].color.replace('bg-', 'text-')}`}>
                    {React.createElement(CATEGORY_MAP[p.category].icon, { size: 16 })}
                  </div>
                  <span className="font-bold text-sm">{p.name}</span>
                </div>
              </td>
              <td className="px-8 py-5 text-center">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${p.stock < 5 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {p.stock} Units
                </span>
              </td>
              <td className="px-8 py-5 text-right font-bold text-sm">{formatNaira(p.price)}</td>
              <td className="px-8 py-5 text-right">
                <button type="button" onClick={() => {
                  if (!confirm(`Delete ${p.name}?`)) return;
                  setProducts((prev) => prev.filter((i) => i.id !== p.id));
                }} className="text-slate-300 hover:text-rose-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr><td colSpan={4} className="py-20 text-center text-slate-400 text-sm">No items in catalog</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PaymentPortal({
  products,
  damages,
  onComplete,
  onLogDamage,
  onNotify
}: {
  products: Product[];
  damages: DamageRecord[];
  onComplete: (s: Omit<Sale, 'id' | 'timestamp'>) => void;
  onLogDamage: (d: { productId: string; quantity: number; type: DamageRecord['type']; note?: string }) => void;
  onNotify: (m: string) => void;
}) {
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [incompleteConfirm, setIncompleteConfirm] = useState<{ open: boolean; missing: string[] }>({ open: false, missing: [] });
  const [damageForm, setDamageForm] = useState<{ productId: string; quantity: number; type: DamageRecord['type']; note: string }>({
    productId: '',
    quantity: 1,
    type: 'Damaged',
    note: ''
  });

  const total = useMemo(() => {
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const p = products.find((prod) => prod.id === id);
      return sum + (p ? p.price * qty : 0);
    }, 0);
  }, [cart, products]);

  const updateCart = (id: string, delta: number) => {
    const p = products.find((i) => i.id === id);
    if (!p) return;
    setCart((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next > p.stock) {
        onNotify('Cannot add more than available stock');
        return prev;
      }
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const finalizeSale = () => {
    // Validate stock again
    const insufficient = Object.entries(cart).find(([id, qty]) => {
      const p = products.find((prod) => prod.id === id);
      return !p || p.stock < qty;
    });
    if (insufficient) {
      onNotify('Insufficient stock for one or more items');
      return;
    }

    onComplete({
      customerName: customer.name,
      customerPhone: customer.phone,
      totalPrice: total,
      paymentAmount: total,
      items: Object.entries(cart).map(([id, qty]) => {
        const p = products.find((prod) => prod.id === id)!;
        return { productId: id, productName: p.name, quantity: qty, unitPrice: p.price, category: p.category };
      })
    });
    setCart({});
    setCustomer({ name: '', phone: '' });
    setIncompleteConfirm({ open: false, missing: [] });
  };

  const submit = (overrideIncomplete = false) => {
    const missing: string[] = [];
    if (!customer.name) missing.push('Customer name');
    if (!customer.phone) missing.push('Phone number');

    // Always surface missing details first
    if (missing.length > 0 && !overrideIncomplete) {
      setIncompleteConfirm({ open: true, missing });
      onNotify('Customer details incomplete');
      return;
    }

    if (total === 0) {
      onNotify('Select at least one item');
      return;
    }

    finalizeSale();
  };

  const logDamage = () => {
    if (!damageForm.productId) {
      onNotify('Select a product to log');
      return;
    }
    if (damageForm.quantity <= 0) {
      onNotify('Quantity must be greater than zero');
      return;
    }

    onLogDamage({
      productId: damageForm.productId,
      quantity: damageForm.quantity,
      type: damageForm.type,
      note: damageForm.note
    });
    setDamageForm({ productId: '', quantity: 1, type: 'Damaged', note: '' });
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right-4">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200">
            <h3 className="font-bold mb-6">Select Devices</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.map((p: Product) => (
                <div key={p.id} className={`p-4 rounded-2xl border-2 transition-all ${cart[p.id] ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-sm truncate">{p.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400">{formatNaira(p.price)} • {p.stock} Left</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => updateCart(p.id, -1)} className="p-1.5 bg-white border border-slate-200 rounded-lg"><Minus size={12}/></button>
                    <span className="flex-1 text-center font-bold text-sm">{cart[p.id] || 0}</span>
                    <button type="button" onClick={() => updateCart(p.id, 1)} className="p-1.5 bg-indigo-600 text-white rounded-lg"><Plus size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 sticky top-28 shadow-sm">
            <h3 className="font-bold mb-6">Transaction Detail</h3>
            <div className="space-y-4">
              <input value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="Customer Name" />
              <input value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="Phone Number" />
              
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Total Due</span>
                <span className="text-xl font-black text-indigo-700">{formatNaira(total)}</span>
              </div>
              <button
                type="button"
                onClick={() => submit(false)}
                className={`w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-lg shadow-slate-200 mt-4 ${total === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                aria-disabled={total === 0}
              >
                Complete Sale
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[1.5rem] border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Damages / Stolen</h3>
              <span className="text-[10px] font-black uppercase text-slate-400">Stock & revenue impact</span>
            </div>
            <select
              value={damageForm.productId}
              onChange={(e) => setDamageForm((f) => ({ ...f, productId: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.stock} left)
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={damageForm.quantity}
                  onChange={(e) => setDamageForm((f) => ({ ...f, quantity: Math.max(1, Number(e.target.value) || 1) }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Type</label>
                <select
                  value={damageForm.type}
                  onChange={(e) => setDamageForm((f) => ({ ...f, type: e.target.value as DamageRecord['type'] }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="Damaged">Damaged</option>
                  <option value="Stolen">Stolen</option>
                </select>
              </div>
            </div>
            <input
              value={damageForm.note}
              onChange={(e) => setDamageForm((f) => ({ ...f, note: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              placeholder="Notes (optional)"
            />
            <button
              type="button"
              onClick={logDamage}
              className="w-full bg-rose-600 text-white py-3 rounded-xl font-bold shadow-md shadow-rose-100 hover:bg-rose-700 transition-colors"
            >
              Log damage / stolen
            </button>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Recent (3)</p>
              {damages.slice(0, 3).map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                  <div>
                    <p className="font-bold">{d.productName}</p>
                    <p className="text-[11px] text-slate-500">{d.quantity} × {formatNaira(d.unitPrice)} • {d.type}</p>
                  </div>
                  <span className="font-black text-rose-600">{formatNaira(d.unitPrice * d.quantity)}</span>
                </div>
              ))}
              {damages.length === 0 && <p className="text-xs text-slate-400">No logged damages yet</p>}
            </div>
          </div>
        </div>
      </div>

      {incompleteConfirm.open && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
          aria-modal="true"
          role="dialog"
        >
          <div className="bg-white w-full max-w-md rounded-[1.75rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-lg font-bold">Incomplete details</h4>
                <p className="text-sm text-slate-500">Some fields are empty. Continue anyway?</p>
              </div>
              <button type="button" onClick={() => setIncompleteConfirm({ open: false, missing: [] })} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={18} />
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-600 mb-6">
              <p className="font-bold text-xs text-slate-500 mb-2">Missing:</p>
              <ul className="list-disc list-inside space-y-1">
                {incompleteConfirm.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIncompleteConfirm({ open: false, missing: [] })} className="flex-1 border border-slate-200 text-slate-700 py-3 rounded-xl font-bold">
                Cancel
              </button>
              <button type="button" onClick={() => submit(true)} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold">
                Proceed anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HistoryTable({ sales }: { sales: Sale[] }) {
  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b">
          <tr>
            <th className="px-8 py-5">Date / ID</th>
            <th className="px-8 py-5">Customer</th>
            <th className="px-8 py-5">Items Sold</th>
            <th className="px-8 py-5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sales.map(s => (
            <tr key={s.id} className="text-sm">
              <td className="px-8 py-5">
                <p className="font-bold text-slate-900">{new Date(s.timestamp).toLocaleDateString()}</p>
                <p className="text-[10px] text-slate-400 font-mono uppercase">{s.id}</p>
              </td>
              <td className="px-8 py-5">
                <p className="font-bold">{s.customerName}</p>
                <p className="text-[10px] text-slate-400 font-bold">{s.customerPhone}</p>
              </td>
              <td className="px-8 py-5">
                 <div className="flex flex-wrap gap-1">
                   {s.items.map((it, idx) => (
                     <span key={idx} className="text-[9px] px-2 py-0.5 bg-slate-50 rounded border border-slate-100 font-bold uppercase">{it.quantity}x {it.productName}</span>
                   ))}
                 </div>
              </td>
              <td className="px-8 py-5 text-right font-black">{formatNaira(s.paymentAmount)}</td>
            </tr>
          ))}
          {sales.length === 0 && (
             <tr><td colSpan={4} className="py-20 text-center text-slate-400">No records found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
