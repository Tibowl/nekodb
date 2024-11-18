import Head from "next/head";
import "../styles/globals.css";
import type { AppProps } from "next/app";
import Footer from "../components/Footer";
import NavBar from "../components/NavBar";

function MyApp({ Component, pageProps, router }: AppProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-700 min-h-screen flex flex-col items-center justify-between text-slate-900 dark:text-slate-100">
      <Head>
        <title>NekoDB</title>
        <link rel="icon" href="/favicon.ico" />
        <meta httpEquiv="content-language" content="en-us"></meta>
      </Head>

      <div className="w-full">
        <NavBar location={router.asPath} />
        <div className="p-4 flex flex-col w-full flex-1 px-1 lg:px-20 items-center justify-center">
          <Component {...pageProps} />
        </div>
      </div>
      <Footer location={router.asPath} />
    </div>
  );
}

export default MyApp;
