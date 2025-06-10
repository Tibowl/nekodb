import type { AppProps } from "next/app"
import Head from "next/head"
import Footer from "../components/Footer"
import NavBar from "../components/NavBar"
import "../styles/globals.css"
import { LanguageProvider } from "../contexts/LanguageContext"
import { useLanguage } from "../hooks/useLanguage"

function AppContent({ Component, pageProps, router }: AppProps) {
  const { currentLanguage, setLanguage } = useLanguage()

  return (
    <div className="bg-slate-50 dark:bg-slate-700 min-h-screen flex flex-col items-center justify-between text-slate-900 dark:text-slate-100">
      <Head>
        <title>NekoDB</title>
        <link rel="icon" href="/favicon.ico" />
        <meta httpEquiv="content-language" content={currentLanguage}></meta>
      </Head>

      <div className="w-full">
        <NavBar
          location={router.asPath}
          language={currentLanguage}
          onLanguageChange={setLanguage}
        />
        <div className="p-4 flex flex-col w-full flex-1 px-1 lg:px-20 items-center justify-center">
          <Component {...pageProps} />
        </div>
      </div>
      <Footer location={router.asPath} />
    </div>
  )
}

function MyApp(props: AppProps) {
  return (
    <LanguageProvider>
      <AppContent {...props} />
    </LanguageProvider>
  )
}

export default MyApp
