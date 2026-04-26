"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function DocsPage() {
  return (
    <>
      <style>{`
        body { margin: 0; background: #0a0a0f; }
        .swagger-ui { font-family: 'Outfit', sans-serif; }
        .swagger-ui .topbar { background: #06060b; border-bottom: 1px solid #1a1a2e; padding: 8px 0; }
        .swagger-ui .topbar .download-url-wrapper { display: none; }
        .swagger-ui .topbar-wrapper img { display: none; }
        .swagger-ui .topbar-wrapper::before {
          content: "ARBITER API DOCS";
          color: #a855f7;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 4px;
          padding-left: 16px;
        }
        .swagger-ui .info { margin: 32px 0; }
        .swagger-ui .info .title { color: #e4e4e7; }
        .swagger-ui .info .description p { color: #9ca3af; }
        .swagger-ui .scheme-container { background: #0a0a0f; box-shadow: none; border-bottom: 1px solid #1a1a2e; }
        .swagger-ui .opblock-tag { color: #e4e4e7; border-bottom: 1px solid #1a1a2e; }
        .swagger-ui .opblock { border-radius: 8px; margin: 8px 0; border: 1px solid #1a1a2e; box-shadow: none; }
        .swagger-ui .opblock .opblock-summary { border-radius: 8px; }
        .swagger-ui .opblock.opblock-get .opblock-summary { background: #1e3a5f20; border-color: #3b82f640; }
        .swagger-ui .opblock.opblock-post .opblock-summary { background: #14532d20; border-color: #22c55e40; }
        .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #3b82f6; }
        .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #22c55e; }
        .swagger-ui .opblock.opblock-options .opblock-summary-method { background: #6b7280; }
        .swagger-ui .opblock-summary-description { color: #9ca3af; }
        .swagger-ui .opblock-body { background: #0d0d18; }
        .swagger-ui .opblock-section-header { background: #10101c; border-bottom: 1px solid #1a1a2e; }
        .swagger-ui .opblock-section-header label { color: #9ca3af; }
        .swagger-ui table thead tr td, .swagger-ui table thead tr th { color: #9ca3af; border-bottom: 1px solid #1a1a2e; }
        .swagger-ui .parameter__name { color: #a855f7; }
        .swagger-ui .parameter__type { color: #6b7280; }
        .swagger-ui .tab li { color: #9ca3af; }
        .swagger-ui .tab li.active { color: #a855f7; }
        .swagger-ui textarea, .swagger-ui input[type=text], .swagger-ui input[type=email] {
          background: #0a0a0f; border: 1px solid #1a1a2e; color: #e4e4e7; border-radius: 6px;
        }
        .swagger-ui .btn { border-radius: 6px; font-weight: 600; }
        .swagger-ui .btn.execute { background: #a855f7; border-color: #a855f7; }
        .swagger-ui .btn.authorize { background: transparent; border-color: #a855f7; color: #a855f7; }
        .swagger-ui .response-col_status { color: #22c55e; }
        .swagger-ui .model-box { background: #10101c; border-radius: 6px; }
        .swagger-ui section.models { border: 1px solid #1a1a2e; border-radius: 8px; }
        .swagger-ui section.models.is-open h4 { border-bottom: 1px solid #1a1a2e; }
        .swagger-ui .model-title { color: #e4e4e7; }
        .swagger-ui .prop-type { color: #a855f7; }
        #swagger-ui-wrapper { max-width: 1200px; margin: 0 auto; padding: 0 16px 64px; }
      `}</style>
      <div id="swagger-ui-wrapper">
        <SwaggerUI
          url="/api/openapi"
          deepLinking={true}
          defaultModelsExpandDepth={-1}
          tryItOutEnabled={true}
        />
      </div>
    </>
  );
}
