import { useEffect, useState } from "react"

interface WikiTextBoxProps {
  text: string
  url: string
}

export default function WikiTextBox({ text, url }: WikiTextBoxProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F4") {
        setIsVisible(prev => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  if (!isVisible) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="fixed top-0 right-0 w-1/2 h-screen bg-white dark:bg-gray-800 shadow-lg p-4 overflow-auto">
      <div className="absolute top-2 right-2 flex flex-row gap-2 z-10">
        <a href={url} target="_blank" rel="noopener noreferrer" className='contents'>
          <button className="p-2 rounded bg-blue-500 text-white hover:bg-blue-600 text-xs">
            View on Wiki
          </button>
        </a>
        <button
          onClick={handleCopy}
          className="p-2 rounded bg-blue-500 text-white hover:bg-blue-600 text-xs"
        >
          Copy All
        </button>
        <button
          onClick={() => setIsVisible(false)}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          ✕
        </button>
      </div>
      <h2 className="text-xl font-bold mb-4">Wiki Format</h2>
      <div className="bg-gray-100 dark:bg-gray-900 rounded p-2 overflow-x-auto mb-2">
        <pre className="whitespace-pre-wrap break-words font-mono text-sm">
          {text}
        </pre>
      </div>
    </div>
  )
}
