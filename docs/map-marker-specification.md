.marker-container {
  position: relative;
}

.marker-pin-google {
  width: 30px;
  height: 42px;
  position: relative;
  transform-origin: bottom;
}

.marker-head {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.marker-tail {
  position: absolute;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 27px;
  clip-path: polygon(50% 100%, 0 0, 100% 0);
}

/* 時期による色分け */
.future-event .marker-head,
.future-event .marker-tail {
  background-color: hsl(var(--primary));
}

.past-event .marker-head,
.past-event .marker-tail {
  background-color: hsl(var(--muted));
}