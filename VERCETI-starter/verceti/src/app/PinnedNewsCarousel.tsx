
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type NewsItem = {
  id: string;
  title: string;
  content: string;
  category: string;
  authorProfile?: { nickname: string; nickname_color: string | null; nickname_font: string | null } | null;
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
  const categoryLabels: Record<string, string> = {
    announcement: "ОГОЛОШЕННЯ",
    event: "ПОДІЯ",
    update: "ОНОВЛЕННЯ",
    important: "ВАЖЛИВО"
  };

  function previous() {
    setActiveIndex((current) =>
      current === 0 ? news.length - 1 : current - 1
    );
  }

  function next() {
    setActiveIndex((current) => (current + 1) % news.length);
  }

  return (
    <div className="hero-news">
      <div className="hero-news-top">
        <div>
          <div className="eyebrow">VERCETTI · PRIVATE COMMUNITY</div>
          <div className="hero-news-label">
            <span className="hero-live-dot" />
            ЗАКРІПЛЕНІ НОВИНИ
          </div>
        </div>

        <div className="hero-symbol">V</div>
      </div>

      <article key={current.id} className="hero-news-content">
        <span className="hero-category">
          {categoryLabels[current.category] ?? current.category.toUpperCase()}
        </span>

        {current.authorProfile && <div style={{ marginTop: 12, color: current.authorProfile.nickname_color ?? undefined, fontFamily: current.authorProfile.nickname_font === "orbitron" ? "Orbitron, Arial, sans-serif" : current.authorProfile.nickname_font === "rajdhani" ? "Rajdhani, Arial, sans-serif" : current.authorProfile.nickname_font === "nunito" ? "Nunito Sans, Arial, sans-serif" : current.authorProfile.nickname_font === "georgia" ? "Georgia, serif" : current.authorProfile.nickname_font === "mono" ? "monospace" : undefined, fontWeight: 700 }}>{current.authorProfile.nickname}</div>}

        <h1>{current.title}</h1>

        <p>{current.content}</p>
      </article>

      <div className="hero-news-bottom">
        <div className="hero-news-actions">
          {news.length > 1 && (
            <>
              <button
                type="button"
                className="hero-arrow"
                onClick={previous}
                aria-label="Попередня новина"
              >
                ←
              </button>

              <button
                type="button"
                className="hero-arrow"
                onClick={next}
                aria-label="Наступна новина"
              >
                →
              </button>

              <span className="hero-counter">
                {activeIndex + 1} / {news.length}
              </span>
            </>
          )}
        </div>

        <Link href="/preview/news" className="hero-all-news">
          Усі новини <span>→</span>
        </Link>
      </div>

      {news.length > 1 && (
        <div className="hero-progress">
          {news.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Перейти до новини ${index + 1}`}
              className={`hero-progress-item ${
                index === activeIndex ? "active" : ""
              }`}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
