import React, { useState, useCallback, useMemo } from 'react'
import Debug from 'debug'

import { Document, Page } from 'react-pdf/dist/entry.webpack'

import * as Hyperfile from '../hyperfile'
import ContentTypes from '../ContentTypes'
import Content, { ContentProps } from './Content'
import { useDocument, useHyperfile, useConfirmableInput } from '../Hooks'
import './PdfContent.css'
import { createDocumentLink } from '../ShareLink'

const log = Debug('pushpin:pdfcontent')

interface PdfDoc {
  title?: string
  hyperfileUrl: Hyperfile.HyperfileUrl
}

PdfContent.minWidth = 3
PdfContent.minHeight = 3
PdfContent.defaultWidth = 18
// no default height to allow it to grow
// suggestion: no max/min width on images, we dont
// know what aspect ratios people will be using day to day
PdfContent.maxWidth = 72

export default function PdfContent(props: ContentProps) {
  const [pdf, changePdf] = useDocument<PdfDoc>(props.hypermergeUrl)
  const pdfData = useHyperfile(pdf && pdf.hyperfileUrl)
  const fileData = useMemo(() => ({ data: pdfData }), [pdfData])
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)

  const [pageInputValue, onPageInput] = useConfirmableInput(String(pageNum), (str) => {
    const nextPageNum = Number.parseInt(str, 10)

    setPageNum(Math.min(numPages, Math.max(1, nextPageNum)))
  })

  function goForward() {
    if (pageNum < numPages) {
      setPageNum(pageNum + 1)
    }
  }

  function goBack() {
    if (pageNum > 1) {
      setPageNum(pageNum - 1)
    }
  }

  const onDocumentLoadSuccess = useCallback(
    (result: any) => {
      const { numPages } = result

      setNumPages(numPages)

      result.getMetadata().then((metadata: any) => {
        const { info = {} } = metadata
        const { Title } = info

        if (Title && pdf && !pdf.title) {
          changePdf((doc) => {
            doc.title = Title
          })
        }
      })
    },
    [changePdf]
  )

  if (!pdf) {
    return null
  }

  const { context } = props

  const forwardDisabled = pageNum >= numPages
  const backDisabled = pageNum <= 1

  const header =
    context === 'workspace' ? (
      <div className="PdfContent-header">
        <button
          disabled={backDisabled}
          type="button"
          onClick={goBack}
          className="PdfContent-navButton"
        >
          <i className="fa fa-angle-left" />
        </button>
        <input
          className="PdfContent-headerInput"
          value={pageInputValue}
          type="number"
          min={1}
          max={numPages}
          onChange={onPageInput}
          onKeyDown={onPageInput}
        />
        <div className="PdfContent-headerNumPages">/ {numPages}</div>
        <button
          disabled={forwardDisabled}
          type="button"
          onClick={goForward}
          className="PdfContent-navButton"
        >
          <i className="fa fa-angle-right" />
        </button>
      </div>
    ) : null

  return (
    <div className="PdfContent">
      {header}
      {pdfData ? (
        <Document file={fileData} onLoadSuccess={onDocumentLoadSuccess}>
          <Page
            loading=""
            pageNumber={pageNum}
            className="PdfContent-page"
            width={1600}
            renderTextLayer={false}
          />
        </Document>
      ) : null}
    </div>
  )
}

interface Attrs {
  hyperfileUrl: Hyperfile.HyperfileUrl
}

function initializeDocument(pdf: PdfDoc, { hyperfileUrl }: Attrs) {
  pdf.hyperfileUrl = hyperfileUrl
}

function initializeContent(entry, callback) {
  const reader = new FileReader()

  reader.onload = () => {
    const buffer = Buffer.from(reader.result as ArrayBuffer)
    Hyperfile.writeBuffer(buffer)
      .then((hyperfileUrl) => {
        // XXX: obviously we shouldn't need to do this
        const contentUrl = Content.initializeContentDoc('pdf', { hyperfileUrl })
        callback(createDocumentLink('pdf', contentUrl))
      })
      .catch((err) => {
        log(err)
      })
  }

  reader.readAsArrayBuffer(entry)
}

ContentTypes.register({
  type: 'pdf',
  name: 'PDF',
  icon: 'book',
  contexts: {
    workspace: PdfContent,
    board: PdfContent,
  },
  initializeDocument,
  initializeContent,
})
