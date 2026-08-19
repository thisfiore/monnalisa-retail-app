import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CONTENT, type Lang } from './Guide.content';

const LANG_KEY = 'guide-lang';

/**
 * Inline markup used throughout Guide.content.ts, so the copy can carry
 * emphasis without any HTML in the strings:
 *
 *   [[Save]]      a thing on screen you click or type into — button, field, tab
 *   **text**      an important word or phrase
 *   ==text==      the one thing in a step you must not get wrong
 *
 * **...** and ==...== may contain further markup — `==press [[Save]] now==`
 * renders a chip inside the highlight. [[...]] is a leaf: its contents are
 * always literal, because a chip names one control. Anything unmarked renders
 * as plain text.
 */
const MARKUP = /\[\[(.+?)\]\]|\*\*(.+?)\*\*|==(.+?)==/g;

/**
 * Chips and highlights inherit their colour from the surrounding text so the
 * same markup reads correctly on a white card, on the amber note boxes, and in
 * the muted grey captions.
 */
function renderRich(text: string): ReactNode {
  // Built per call rather than reused: a module-level /g regex carries
  // lastIndex between calls and would silently skip matches.
  const re = new RegExp(MARKUP.source, 'g');
  const out: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > cursor) out.push(text.slice(cursor, match.index));

    const [raw, chip, bold, mark] = match;
    if (chip !== undefined) {
      out.push(
        <span
          key={match.index}
          className="inline-block rounded-md border border-black/15 bg-black/[0.06] px-1.5 py-px font-semibold text-[0.95em] whitespace-nowrap"
        >
          {chip}
        </span>,
      );
    } else if (bold !== undefined) {
      out.push(
        <strong key={match.index} className="font-semibold">
          {renderRich(bold)}
        </strong>,
      );
    } else {
      out.push(
        // The highlight bleeds via box-shadow rather than padding: padding
        // would push a trailing full stop away from the word it belongs to.
        <mark
          key={match.index}
          className="bg-pink-100 text-inherit rounded-[2px] shadow-[0_0_0_3px_#fce7f3] box-decoration-clone"
        >
          {renderRich(mark)}
        </mark>,
      );
    }

    cursor = match.index + raw.length;
  }

  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function isLang(value: string | null): value is Lang {
  return value === 'it' || value === 'en';
}

/**
 * Resolve the initial language once, in priority order: ?lang= in the URL (so a
 * link can pin a language), then the last choice made on this device, then the
 * browser's own preference, defaulting to Italian for the Italian stores.
 */
function initialLang(fromUrl: string | null): Lang {
  if (isLang(fromUrl)) return fromUrl;
  const stored = localStorage.getItem(LANG_KEY);
  if (isLang(stored)) return stored;
  return navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en';
}

/**
 * Public, unauthenticated how-to for store staff. Deliberately self-contained:
 * no auth context, no API calls, no shared Header — it must render for someone
 * who has never signed in, on a phone, from a link or a QR code.
 */
export function Guide() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lang, setLang] = useState<Lang>(() => initialLang(searchParams.get('lang')));

  const t = CONTENT[lang];

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
    document.title = `${t.title} · Monnalisa`;
  }, [lang, t.title]);

  const chooseLang = (next: Lang) => {
    setLang(next);
    // Keep the URL shareable in the language currently on screen, without
    // pushing a history entry for every toggle.
    const params = new URLSearchParams(searchParams);
    params.set('lang', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className="bg-black sticky top-0 z-30 print:static">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <img
            src="/logo-white.png"
            alt="Monnalisa"
            className="h-6 sm:h-7 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <h1 className="hidden text-lg font-bold text-white tracking-wide">MONNALISA</h1>

          <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1 print:hidden">
            {(['it', 'en'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => chooseLang(code)}
                aria-pressed={lang === code}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                  lang === code
                    ? 'bg-white text-gray-900'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          {t.subtitle}
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{t.title}</h2>
        <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8">
          {renderRich(t.intro)}
        </p>

        {/* Table of contents — on a phone this is the whole guide at a glance. */}
        <nav className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-10">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
            {t.tocTitle}
          </h3>
          <ol className="space-y-1">
            {t.steps.map((step) => (
              <li key={step.id}>
                <a
                  href={`#${step.id}`}
                  className="flex items-center gap-3 py-2 text-gray-900 hover:text-pink-600 transition-colors"
                >
                  <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-black text-white text-xs font-bold">
                    {step.number}
                  </span>
                  <span className="font-medium">{step.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-12">
          {t.steps.map((step) => (
            <section key={step.id} id={step.id} className="scroll-mt-20">
              <div className="flex items-start gap-3 mb-3">
                <span className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-black text-white text-sm font-bold">
                  {step.number}
                </span>
                <h3 className="text-2xl font-bold text-gray-900 pt-0.5">{step.title}</h3>
              </div>
              <p className="text-gray-600 leading-relaxed mb-6 sm:ml-11">
                {renderRich(step.intro)}
              </p>

              <ol className="space-y-3 mb-8 sm:ml-11">
                {step.actions.map((action, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-gray-900 leading-relaxed">{renderRich(action)}</span>
                  </li>
                ))}
              </ol>

              <div className="space-y-6 sm:ml-11">
                {step.shots.map((shot) => (
                  <figure key={shot.src}>
                    <img
                      src={shot.src}
                      alt={shot.alt}
                      loading="lazy"
                      width={1456}
                      height={832}
                      className="w-full h-auto rounded-xl border border-gray-200 bg-white shadow-sm"
                    />
                    <figcaption className="text-sm text-gray-500 mt-2.5 leading-relaxed">
                      {renderRich(shot.caption)}
                    </figcaption>
                  </figure>
                ))}
              </div>

              {step.note && (
                <div className="mt-8 sm:ml-11 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-900 leading-relaxed">
                    {renderRich(step.note)}
                  </p>
                </div>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.helpTitle}</h3>
          <p className="text-gray-600 leading-relaxed">{renderRich(t.helpBody)}</p>
        </div>

        <div className="mt-8 flex items-center justify-between print:hidden">
          <a href="#" className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
            ↑ {t.backToTop}
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="text-sm text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
          >
            {t.printLabel}
          </button>
        </div>
      </main>
    </div>
  );
}
