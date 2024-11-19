import Link from "next/link"
import React from "react"


function FormattedLink({ children, href, className = "", style = {}, location, target = undefined, prefetch = undefined }: any) {
  let colors = "text-blue-800 dark:text-blue-100 hover:text-blue-500 dark:hover:text-blue-400"
  if (href == location)
    colors = "text-blue-600 dark:text-blue-400 hover:text-blue-400 dark:hover:text-blue-500"
  else if (location?.startsWith(href) && href != "/")
    colors = "text-blue-700 dark:text-blue-300 hover:text-blue-400 dark:hover:text-blue-400"

  return (
    <Link href={href} prefetch={prefetch} className={`${className} no-underline transition-all duration-200 ${colors}`} style={style} target={target}>
      {children}
    </Link>
  )
}

export default FormattedLink
