
"use client";

import { useEffect, useState } from "react";

type NewsItem = {
  id: string;
  title: string;
  content: string;
  category: string;
};

export default function PinnedNewsCarousel({
  news
}: {
  news: NewsItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (news.length < 2) return;

    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % news.length);
    }, 7000);

    return () => clearInterval(timer);
  }, [news.length]);

  if (news.length === 0) return null;

  const current = news[activeIndex];

  function previous() {
    setActiveIndex((current) =>
      current === 0 ? news.length - 1 : current - 1
    );
  }

  function next() {
    setActiveIndex((current) => (current + 1) % news.length);
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div className="eyebrow">ЗАКРІПЛЕНІ НОВИНИ</div>

      <article
        key={current.id}
        style={{
          padding: "18px 0",
          minHeight: 150
        }}
      >
        <h1>{current.title}</h1>

        <p
          style={{
            whiteSpace: "pre-wrap",
            lineHeight: 1.7,
            overflowWrap: "anywhere"
          }}
        >
          {current.content}
        </p>
      </article>

      {news.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 12
          }}
        >
          <button
            type="button"
            className="btn secondary"
            onClick={previous}
            aria-label="Попередня новина"
          >
            ←
          </button>

          <span className="muted" style={{ fontSize: 12 }}>
            {activeIndex + 1} / {news.length}
          </span>

          <button
            type="button"
            className="btn secondary"
            onClick={next}
            aria-label="Наступна новина"
          >
            →
          </button>
        </div>
      )}

      <div className="welcome-actions">
        <a className="btn" href="/news">
          Усі новини
        </a>
      </div>
    </div>
  );
}
