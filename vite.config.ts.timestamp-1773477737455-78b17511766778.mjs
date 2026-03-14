// vite.config.ts
import { defineConfig } from "file:///C:/Users/HP-COMPLIANCE/Downloads/JOULE/PRODUCT%20DIGITAL/VISORA%20V.1/APP%20VIA%20VERCEL/visora-v.2/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/HP-COMPLIANCE/Downloads/JOULE/PRODUCT%20DIGITAL/VISORA%20V.1/APP%20VIA%20VERCEL/visora-v.2/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///C:/Users/HP-COMPLIANCE/Downloads/JOULE/PRODUCT%20DIGITAL/VISORA%20V.1/APP%20VIA%20VERCEL/visora-v.2/node_modules/@tailwindcss/vite/dist/index.mjs";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\HP-COMPLIANCE\\Downloads\\JOULE\\PRODUCT DIGITAL\\VISORA V.1\\APP VIA VERCEL\\visora-v.2";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, ".")
    }
  },
  server: {
    port: 3e3,
    host: "0.0.0.0"
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) return "react-vendor";
          if (id.includes("@supabase/supabase-js")) return "supabase";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@fal-ai")) return "fal";
          return "vendor";
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxIUC1DT01QTElBTkNFXFxcXERvd25sb2Fkc1xcXFxKT1VMRVxcXFxQUk9EVUNUIERJR0lUQUxcXFxcVklTT1JBIFYuMVxcXFxBUFAgVklBIFZFUkNFTFxcXFx2aXNvcmEtdi4yXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxIUC1DT01QTElBTkNFXFxcXERvd25sb2Fkc1xcXFxKT1VMRVxcXFxQUk9EVUNUIERJR0lUQUxcXFxcVklTT1JBIFYuMVxcXFxBUFAgVklBIFZFUkNFTFxcXFx2aXNvcmEtdi4yXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9IUC1DT01QTElBTkNFL0Rvd25sb2Fkcy9KT1VMRS9QUk9EVUNUJTIwRElHSVRBTC9WSVNPUkElMjBWLjEvQVBQJTIwVklBJTIwVkVSQ0VML3Zpc29yYS12LjIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIHRhaWx3aW5kY3NzKCksXG4gIF0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLicpLFxuICAgIH1cbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMzAwMCxcbiAgICBob3N0OiAnMC4wLjAuMCcsXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xuICAgICAgICAgIGlmICghaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpKSByZXR1cm47XG5cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBpZC5pbmNsdWRlcygncmVhY3QnKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoJ3JlYWN0LWRvbScpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcygncmVhY3Qtcm91dGVyLWRvbScpXG4gICAgICAgICAgKSByZXR1cm4gJ3JlYWN0LXZlbmRvcic7XG5cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcycpKSByZXR1cm4gJ3N1cGFiYXNlJztcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2x1Y2lkZS1yZWFjdCcpKSByZXR1cm4gJ2ljb25zJztcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ0BmYWwtYWknKSkgcmV0dXJuICdmYWwnO1xuXG4gICAgICAgICAgcmV0dXJuICd2ZW5kb3InO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNmQsU0FBUyxvQkFBb0I7QUFDMWYsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sVUFBVTtBQUhqQixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsRUFDZDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsR0FBRztBQUFBLElBQ2xDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGFBQWEsSUFBSTtBQUNmLGNBQUksQ0FBQyxHQUFHLFNBQVMsY0FBYyxFQUFHO0FBRWxDLGNBQ0UsR0FBRyxTQUFTLE9BQU8sS0FDbkIsR0FBRyxTQUFTLFdBQVcsS0FDdkIsR0FBRyxTQUFTLGtCQUFrQixFQUM5QixRQUFPO0FBRVQsY0FBSSxHQUFHLFNBQVMsdUJBQXVCLEVBQUcsUUFBTztBQUNqRCxjQUFJLEdBQUcsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUN4QyxjQUFJLEdBQUcsU0FBUyxTQUFTLEVBQUcsUUFBTztBQUVuQyxpQkFBTztBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
