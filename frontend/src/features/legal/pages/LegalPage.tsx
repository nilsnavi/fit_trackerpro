/**
 * LegalPage — политика конфиденциальности и согласие на обработку данных (WS1-14).
 * Открывается из онбординга и из профиля.
 */
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { legalDocuments, type LegalDocumentKey } from '@features/legal/content'

function isLegalKey(value: string | undefined): value is LegalDocumentKey {
    return value === 'privacy' || value === 'consent'
}

export function LegalPage() {
    const { doc } = useParams<{ doc: string }>()
    const navigate = useNavigate()
    const key: LegalDocumentKey = isLegalKey(doc) ? doc : 'privacy'
    const document = legalDocuments[key]

    return (
        <main className="mx-auto w-full max-w-[560px] px-4 py-6">
            <button
                type="button"
                onClick={() => navigate(-1)}
                className="mb-4 flex items-center gap-2 text-sm text-telegram-hint"
            >
                <ArrowLeft className="h-4 w-4" />
                Назад
            </button>

            <h1 className="text-xl font-semibold text-telegram-text">{document.title}</h1>
            <p className="mt-1 text-xs text-telegram-hint">
                Редакция от {document.updatedAt} · версия {document.version}
            </p>

            <p className="mt-4 text-sm leading-relaxed text-telegram-text">{document.intro}</p>

            {document.sections.map((section) => (
                <section key={section.heading} className="mt-5">
                    <h2 className="text-base font-semibold text-telegram-text">
                        {section.heading}
                    </h2>
                    <ul className="mt-2 space-y-2">
                        {section.paragraphs.map((paragraph) => (
                            <li
                                key={paragraph}
                                className="text-sm leading-relaxed text-telegram-hint"
                            >
                                • {paragraph}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </main>
    )
}
