import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

@Directive({ selector: '[appMobileNavMotion]' })
export class MobileNavMotionDirective {
  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroy = inject(DestroyRef);
    let positioned = false;
    let frame = 0;
    let readyFrame = 0;
    const measure = () => {
      frame = 0;
      const icon = element.querySelector<HTMLElement>('a[aria-current="page"] app-icon');
      if (!icon || !element.isConnected) return;
      const bar = element.getBoundingClientRect();
      const bounds = icon.getBoundingClientRect();
      element.style.setProperty('--mobile-nav-active-x', bounds.left - bar.left - element.clientLeft + 'px');
      element.style.setProperty('--mobile-nav-active-y', bounds.top - bar.top - element.clientTop + 'px');
      if (positioned) return;
      positioned = true;
      element.classList.add('mobile-nav-positioned');
      readyFrame = requestAnimationFrame(() => {
        readyFrame = requestAnimationFrame(() => element.classList.add('mobile-nav-motion-ready'));
      });
    };
    const update = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const selection = new MutationObserver(records => {
      if (records.some(record => record.type === 'childList' || (record.target instanceof Element && record.target.matches('a')))) update();
    });
    const resize = new ResizeObserver(update);
    afterNextRender(() => {
      selection.observe(element, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-current'] });
      resize.observe(element);
      element.querySelectorAll('a > span').forEach(label => resize.observe(label));
      measure();
    });
    destroy.onDestroy(() => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(readyFrame);
      selection.disconnect();
      resize.disconnect();
    });
  }
}
