import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Заредените данни на страниците се считат за свежи 5 минути — без презареждане при връщане.
    defaultStaleTime: 5 * 60_000,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
