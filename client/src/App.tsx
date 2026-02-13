import { BrowserRouter, useLocation } from 'react-router-dom'
import { AppRoutes } from './router'
import './styles/animations.css'
import { useEffect } from 'react';

function RouteAnimator() {
  const loc = useLocation();
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    // animate direct children of main with stagger
    const children = Array.from(main.querySelectorAll(':scope > *')) as HTMLElement[];
    children.forEach((el, i) => {
      el.classList.add('fade-in-up');
      el.style.setProperty('--stagger-index', String(i));
    });
    // animate cards inside main
    const cards = Array.from(main.querySelectorAll('.rounded-xl, .bg-white')) as HTMLElement[];
    cards.forEach((el, i) => {
      el.classList.add('fade-in-up');
      el.style.setProperty('--stagger-index', String((i % 10) + 1));
    });
  }, [loc]);
  return null;
}

function App() {
  return (
    <BrowserRouter basename={__BASE_PATH__}>
      <RouteAnimator />
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App