import React from 'react';
import '../styles/Loader.css';

export default function Loader() {
  return (
    <div className="loader">
      <div className="sphere"></div>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <defs>
          <mask id="waves" maskUnits="userSpaceOnUse">
            <g fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5,50 C25,50 30,20 50,20 C70,20 75,50 95,50"></path>
              <path d="M5,50 C25,50 30,20 50,20 C70,20 75,50 95,50"></path>
              <path d="M5,50 C25,50 30,80 50,80 C70,80 75,50 95,50"></path>
              <path d="M5,50 C25,50 30,80 50,80 C70,80 75,50 95,50"></path>
            </g>
          </mask>
          <mask id="blurriness" maskUnits="userSpaceOnUse">
            <g>
              <circle cx="50" cy="50" r="50" fill="white"></circle>
              <ellipse cx="50" cy="50" rx="25" ry="25" fill="black"></ellipse>
            </g>
          </mask>
          <mask id="clipping" maskUnits="userSpaceOnUse">
            <ellipse cx="50" cy="50" rx="25" ry="50" fill="white"></ellipse>
          </mask>
          <mask id="fade" maskUnits="userSpaceOnUse">
            <ellipse cx="50" cy="50" rx="45" ry="50" fill="white"></ellipse>
          </mask>
        </defs>
        <g id="shapes" mask="url(#fade)">
          <g mask="url(#clipping)">
            <circle cx="50" cy="50" r="50" fill="currentColor" mask="url(#waves)"></circle>
          </g>
          <g mask="url(#blurriness)">
            <circle cx="50" cy="50" r="50" fill="currentColor" mask="url(#waves)"></circle>
          </g>
        </g>
      </svg>
    </div>
  );
}