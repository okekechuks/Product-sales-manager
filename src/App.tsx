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
  Download,
  Search,
  Pencil
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
  receiptReceivedAt?: string;
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
      } catch (e) {
        console.error('Failed to load local data', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, sales }));
  }, [products, sales]);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Analytics derived from state
  const analytics = useMemo(() => {
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.paymentAmount, 0);
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

    return { totalRevenue, totalSales: sales.length, stockValue, chartData };
  }, [sales, products]);

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
          {view === 'payments' && <PaymentPortal products={products} onComplete={processSale} onNotify={notify} />}
          {view === 'history' && (
            <HistoryTable
              sales={sales}
              onUpdateSale={(id, updates) =>
                setSales(prev =>
                  prev.map(s => (s.id === id ? { ...s, ...updates } : s))
                )
              }
              onDeleteSale={id =>
                setSales(prev => prev.filter(s => s.id !== id))
              }
            />
          )}
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

function PaymentPortal({ products, onComplete, onNotify }: { products: Product[]; onComplete: (s: Omit<Sale, 'id' | 'timestamp'>) => void; onNotify: (m: string) => void; }) {
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [receiptReceivedAt, setReceiptReceivedAt] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<string>('');

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

  const submit = () => {
    if (!customer.name || total === 0) {
      onNotify('Provide customer name and select items');
      return;
    }

    const payment = Number(amountPaid);
    if (!amountPaid || isNaN(payment) || payment <= 0) {
      onNotify('Enter a valid amount paid');
      return;
    }
    if (payment > total) {
      onNotify('Amount paid cannot be more than total due');
      return;
    }
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
      paymentAmount: payment,
      receiptReceivedAt,
      items: Object.entries(cart).map(([id, qty]) => {
        const p = products.find((prod) => prod.id === id)!;
        return { productId: id, productName: p.name, quantity: qty, unitPrice: p.price, category: p.category };
      })
    });
    setCart({});
    setCustomer({ name: '', phone: '' });
    setAmountPaid('');
    setReceiptReceivedAt('');
  };

  return (
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

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Receipt Collection Date</label>
              <input
                type="date"
                value={receiptReceivedAt}
                onChange={e => setReceiptReceivedAt(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Amount Paid</label>
              <input
                type="number"
                min={0}
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                placeholder="Enter amount received"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase">Total Due</span>
              <span className="text-xl font-black text-indigo-700">{formatNaira(total)}</span>
            </div>
            <button type="button" onClick={submit} disabled={!customer.name || total === 0} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-lg shadow-slate-200 disabled:opacity-20 mt-4">
              Complete Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryTable({
  sales,
  onUpdateSale,
}: {
  sales: Sale[];
  onUpdateSale: (id: string, updates: Partial<Sale>) => void;
  onDeleteSale: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    customerName: string;
    customerPhone: string;
    paymentAmount: string;
    receiptReceivedAt?: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<
    'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'receipt_desc' | 'receipt_asc'
  >('date_desc');

  const startEdit = (sale: Sale) => {
    setEditingId(sale.id);
    setDraft({
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      paymentAmount: String(sale.paymentAmount),
      receiptReceivedAt: sale.receiptReceivedAt ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = (id: string) => {
    if (!draft) return;
    const amount = Number(draft.paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Enter a valid amount'); // uses built-in alert for simplicity
      return;
    }
    onUpdateSale(id, {
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      paymentAmount: amount,
      receiptReceivedAt: draft.receiptReceivedAt,
    });
    setEditingId(null);
    setDraft(null);
  };

  const filteredAndSorted = [...sales]
    .filter(s =>
      !searchQuery
        ? true
        : s.customerName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortOption) {
        case 'date_asc':
          return a.timestamp - b.timestamp;
        case 'date_desc':
          return b.timestamp - a.timestamp;
        case 'amount_asc':
          return a.paymentAmount - b.paymentAmount;
        case 'amount_desc':
          return b.paymentAmount - a.paymentAmount;
        case 'receipt_asc': {
          // Compare by calendar month (Jan–Dec), ignoring year
          const ma = parseInt((a.receiptReceivedAt ?? '').slice(5, 7) || '0', 10);
          const mb = parseInt((b.receiptReceivedAt ?? '').slice(5, 7) || '0', 10);
          return ma - mb;
        }
        case 'receipt_desc': {
          const ma = parseInt((a.receiptReceivedAt ?? '').slice(5, 7) || '0', 10);
          const mb = parseInt((b.receiptReceivedAt ?? '').slice(5, 7) || '0', 10);
          return mb - ma;
        }
        default:
          return 0;
      }
    });

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-8 pt-6 pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search customer name"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm outline-none"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            type="button"
            onClick={() => setSearchQuery(searchInput.trim())}
            className="px-3 py-2 rounded-full bg-slate-900 text-white text-xs font-bold"
          >
            Search
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase font-bold text-slate-400">Sort by</span>
          <select
            value={sortOption}
            onChange={e => setSortOption(e.target.value as typeof sortOption)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs font-bold"
          >
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="amount_desc">Amount (High–Low)</option>
            <option value="amount_asc">Amount (Low–High)</option>
            <option value="receipt_desc">Receipt date (Newest)</option>
            <option value="receipt_asc">Receipt date (Oldest)</option>
          </select>
        </div>
      </div>

      <table className="w-full text-left">
        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b">
          <tr>
            <th className="px-8 py-5">Date / ID</th>
            <th className="px-8 py-5">Customer</th>
            <th className="px-8 py-5">Items Sold</th>
            <th className="px-8 py-5 text-right">Amount</th>
            <th className="px-8 py-5 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {filteredAndSorted.map(s => {
            const isEditing = editingId === s.id;
            return (
              <tr key={s.id} className="text-sm">
                <td className="px-8 py-5 align-top">
                  <p className="font-bold text-slate-900">{new Date(s.timestamp).toLocaleDateString()}</p>
                  <p className="text-[10px] text-slate-400 font-mono uppercase">{s.id}</p>
                  {s.receiptReceivedAt && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Receipt: {s.receiptReceivedAt}
                    </p>
                  )}
                </td>
                <td className="px-8 py-5 align-top">
                  {isEditing && draft ? (
                    <div className="space-y-2">
                      <input
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        value={draft.customerName}
                        onChange={e =>
                          setDraft(prev =>
                            prev ? { ...prev, customerName: e.target.value } : prev
                          )
                        }
                      />
                      <input
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        value={draft.customerPhone}
                        onChange={e =>
                          setDraft(prev =>
                            prev ? { ...prev, customerPhone: e.target.value } : prev
                          )
                        }
                      />
                    </div>
                  ) : (
                    <>
                      <p className="font-bold">{s.customerName}</p>
                      <p className="text-[10px] text-slate-400 font-bold">
                        {s.customerPhone}
                      </p>
                    </>
                  )}
                </td>
                <td className="px-8 py-5 align-top">
                  <div className="flex flex-wrap gap-1">
                    {s.items.map((it, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] px-2 py-0.5 bg-slate-50 rounded border border-slate-100 font-bold uppercase"
                      >
                        {it.quantity}x {it.productName}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-8 py-5 text-right font-black align-top">
                  {isEditing && draft ? (
                    <input
                      type="number"
                      className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right"
                      value={draft.paymentAmount}
                      onChange={e =>
                        setDraft(prev =>
                          prev ? { ...prev, paymentAmount: e.target.value } : prev
                        )
                      }
                    />
                  ) : (
                    formatNaira(s.paymentAmount)
                  )}
                </td>
                <td className="px-8 py-5 text-right align-top">
                  {isEditing ? (
                    <div className="flex gap-2 justify-end text-xs">
                      <button
                        type="button"
                        onClick={() => saveEdit(s.id)}
                        className="p-2 rounded-full bg-emerald-600 text-white"
                        title="Save"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="p-2 rounded-full bg-slate-100 text-slate-600"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm('Delete this record?')) return;
                          onDeleteSale(s.id);
                        }}
                        className="p-2 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {sales.length === 0 && (
             <tr><td colSpan={4} className="py-20 text-center text-slate-400">No records found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
