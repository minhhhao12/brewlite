'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type HealthState = 'idle' | 'loading' | 'ok' | 'error';

const SAMPLE_MENU = [
  { name: 'Cà phê sữa', price: '35.000đ', note: 'Size S/M/L' },
  { name: 'Americano', price: '40.000đ', note: 'Size S/M/L' },
  { name: 'Cappuccino', price: '45.000đ', note: 'Size S/M/L' },
  { name: 'Trà đào', price: '39.000đ', note: 'Size S/M/L' },
];

export default function HomePage() {
  const [health, setHealth] = useState<HealthState>('idle');

  async function checkApi() {
    setHealth('loading');
    try {
      const response = await fetch(`${API_URL}/health`);
      setHealth(response.ok ? 'ok' : 'error');
    } catch {
      setHealth('error');
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Mobile-first · PWA</p>
        <h1>BrewLite</h1>
        <p className="tagline">Đặt cà phê, thanh toán không tiền mặt, nhận tại quầy.</p>
        <p className="status-line">
          Trạng thái API:{' '}
          <strong data-state={health}>
            {health === 'idle' && 'chưa kiểm tra'}
            {health === 'loading' && 'đang kiểm tra…'}
            {health === 'ok' && 'ok'}
            {health === 'error' && 'không kết nối được'}
          </strong>
        </p>
        <button type="button" onClick={checkApi} disabled={health === 'loading'}>
          Kiểm tra GET /health
        </button>
      </header>

      <section aria-labelledby="menu-title">
        <div className="section-heading">
          <h2 id="menu-title">Menu hôm nay</h2>
          <span className="badge">Dữ liệu mẫu</span>
        </div>
        <p className="muted">
          Skeleton Task 3: UI menu thật và API <code>GET /products</code> sẽ được nối ở Sprint 1
          (TODO).
        </p>
        <div className="menu-grid">
          {SAMPLE_MENU.map((item) => (
            <article className="menu-card" key={item.name}>
              <div className="cup" aria-hidden="true" />
              <h3>{item.name}</h3>
              <p className="muted">{item.note}</p>
              <strong>{item.price}</strong>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <p>
          API: <code>{API_URL}</code>
        </p>
        <p>PWA manifest + service worker có sẵn; nghiệp vụ đặt đơn/thanh toán là TODO Sprint 2.</p>
      </footer>
    </main>
  );
}
