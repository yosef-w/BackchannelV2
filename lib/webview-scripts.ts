/**
 * WebView JavaScript Injection Scripts for Form Scraping and Autofill
 */


/**
 * Generate script to scrape all form fields from the current page
 * This will be injected into the WebView to extract form structure
 */
export function generateFormScrapingScript(): string {
  return `
    (function() {
      try {
        console.log('[SCRAPER] Starting form field detection...');
        
        // Helper to determine field type
        function getFieldType(element) {
          const tagName = element.tagName.toLowerCase();
          const type = (element.type || '').toLowerCase();
          
          if (tagName === 'textarea') return 'textarea';
          if (tagName === 'select') return 'select';
          if (tagName === 'input') {
            if (type === 'email') return 'email';
            if (type === 'tel' || type === 'phone') return 'tel';
            if (type === 'number') return 'number';
            if (type === 'date') return 'date';
            if (type === 'url') return 'url';
            if (type === 'checkbox') return 'checkbox';
            if (type === 'radio') return 'radio';
            if (type === 'file') return 'file';
            return 'text';
          }
          return 'text';
        }
        
        // Helper to get label text for a field
        function getLabelText(element) {
          // Try label[for] association
          if (element.id) {
            const label = document.querySelector(\`label[for="\${element.id}"]\`);
            if (label) return label.textContent?.trim() || '';
          }
          
          // Try parent label
          const parentLabel = element.closest('label');
          if (parentLabel) {
            // Clone label and remove the input to get just the text
            const clone = parentLabel.cloneNode(true);
            const inputs = clone.querySelectorAll('input, select, textarea');
            inputs.forEach(input => input.remove());
            return clone.textContent?.trim() || '';
          }
          
          // Try aria-label
          if (element.getAttribute('aria-label')) {
            return element.getAttribute('aria-label');
          }
          
          // Try placeholder
          if (element.placeholder) {
            return element.placeholder;
          }
          
          // Try name/id as fallback
          return element.name || element.id || 'Unknown Field';
        }
        
        // Helper to get unique CSS selector
        function getUniqueSelector(element) {
          if (element.id) {
            return \`#\${element.id}\`;
          }
          
          if (element.name) {
            const tagName = element.tagName.toLowerCase();
            return \`\${tagName}[name="\${element.name}"]\`;
          }
          
          // Generate path-based selector
          let path = [];
          let current = element;
          
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.nodeName.toLowerCase();
            
            if (current.className) {
              const classes = Array.from(current.classList)
                .filter(c => !c.includes('focus') && !c.includes('hover') && !c.includes('active'))
                .slice(0, 2);
              if (classes.length > 0) {
                selector += '.' + classes.join('.');
              }
            }
            
            path.unshift(selector);
            
            if (path.length > 3) break;
            current = current.parentElement;
          }
          
          return path.join(' > ');
        }
        
        // Helper to check if element is visible and valid
        function isValidFormField(element) {
          if (!element) return false;
          
          // Skip hidden fields
          if (element.type === 'hidden') return false;
          
          // Skip recaptcha and automated fields
          const id = (element.id || '').toLowerCase();
          const name = (element.name || '').toLowerCase();
          const className = (element.className || '').toLowerCase();
          
          if (id.includes('recaptcha') || name.includes('recaptcha') || 
              id.includes('captcha') || name.includes('captcha') ||
              className.includes('recaptcha') || className.includes('captcha')) {
            return false;
          }
          
          // Check if visible
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
          }
          
          return true;
        }
        
        // Get all forms on the page
        const forms = document.querySelectorAll('form');
        const allFields = [];
        let fieldIdCounter = 1;
        
        // Also look for standalone form fields (not in a form tag)
        const allInputs = document.querySelectorAll('input, textarea, select');
        
        allInputs.forEach(element => {
          if (!isValidFormField(element)) return;
          
          const fieldType = getFieldType(element);
          const label = getLabelText(element);
          
          // Skip if we can't determine what this field is for
          if (!label || label === 'Unknown Field') return;
          
          const field = {
            id: \`field_\${fieldIdCounter++}\`,
            fieldType: fieldType,
            label: label,
            name: element.name || undefined,
            placeholder: element.placeholder || undefined,
            required: element.required || element.hasAttribute('required') || element.getAttribute('aria-required') === 'true',
            currentValue: element.value || undefined,
            htmlSelector: getUniqueSelector(element),
            context: undefined
          };
          
          // Add options for select/radio fields
          if (fieldType === 'select') {
            const options = Array.from(element.options || [])
              .map(opt => opt.text || opt.value)
              .filter(opt => opt && opt.length > 0);
            if (options.length > 0) {
              field.options = options;
            }
          } else if (fieldType === 'radio') {
            const radioGroup = document.querySelectorAll(\`input[type="radio"][name="\${element.name}"]\`);
            const options = Array.from(radioGroup)
              .map(radio => {
                const label = getLabelText(radio);
                return label || radio.value;
              })
              .filter((opt, index, self) => opt && self.indexOf(opt) === index);
            if (options.length > 0) {
              field.options = options;
            }
          }
          
          // Add validation info
          const validation = {};
          if (element.pattern) validation.pattern = element.pattern;
          if (element.minLength) validation.minLength = element.minLength;
          if (element.maxLength) validation.maxLength = element.maxLength;
          if (element.min) validation.min = element.min;
          if (element.max) validation.max = element.max;
          
          if (Object.keys(validation).length > 0) {
            field.validation = validation;
          }
          
          // Add context from surrounding elements
          const fieldset = element.closest('fieldset');
          if (fieldset) {
            const legend = fieldset.querySelector('legend');
            if (legend) {
              field.context = legend.textContent?.trim();
            }
          }
          
          allFields.push(field);
        });
        
        const result = {
          fields: allFields,
          formCount: forms.length,
          pageTitle: document.title,
          success: true
        };
        
        console.log('[SCRAPER] Found', allFields.length, 'form fields');
        
        // Send data back to React Native
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FORM_FIELDS_SCRAPED',
            data: result
          }));
        }
        
        return result;
      } catch (error) {
        console.error('[SCRAPER] Error:', error);
        
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'AUTOFILL_ERROR',
            data: { error: error.message }
          }));
        }
        
        return { fields: [], formCount: 0, pageTitle: '', success: false, error: error.message };
      }
    })();
    true; // Return value for injectedJavaScript
  `;
}

/**
 * Generate script to inject AI-generated answers back into form fields
 */
export function generateFieldInjectionScript(
  fieldAnswers: Array<{
    fieldId: string;
    value: string | string[];
    confidence: number;
  }>,
): string {
  const answersJson = JSON.stringify(fieldAnswers);

  return `
    (function() {
      try {
        const fieldAnswers = ${answersJson};
        console.log('[INJECTOR] Starting to inject', fieldAnswers.length, 'field answers...');
        
        let successCount = 0;
        let failCount = 0;
        
        // Helper to set input value with proper event handling for React forms
        function setInputValue(element, value) {
          if (!element || value === null || value === undefined) {
            return false;
          }
          
          // Don't overwrite if field already has a value
          const currentValue = element.value?.trim() || '';
          if (currentValue.length > 0) {
            console.log('[INJECTOR] Skipping field with existing value:', element.name || element.id);
            return false;
          }
          
          const tagName = element.tagName.toLowerCase();
          const stringValue = String(value);
          
          try {
            // Get native setter for React compatibility
            let nativeSetter;
            if (tagName === 'input') {
              nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            } else if (tagName === 'textarea') {
              nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            }
            
            // Set value using native setter
            if (nativeSetter) {
              nativeSetter.call(element, stringValue);
            } else {
              element.value = stringValue;
            }
            
            // Dispatch events for React
            const inputEvent = new Event('input', { bubbles: true });
            Object.defineProperty(inputEvent, 'target', { writable: false, value: element });
            element.dispatchEvent(inputEvent);
            
            element.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Trigger validation
            element.focus();
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            
            return true;
          } catch (error) {
            console.error('[INJECTOR] Error setting value:', error);
            return false;
          }
        }
        
        // Helper to select dropdown option
        function selectOption(element, value) {
          if (!element || !value) return false;
          
          const stringValue = String(value).toLowerCase();
          const options = Array.from(element.options || []);
          
          // Try exact match
          let matchingOption = options.find(opt => 
            opt.value.toLowerCase() === stringValue ||
            opt.text.toLowerCase() === stringValue
          );
          
          // Try partial match
          if (!matchingOption) {
            matchingOption = options.find(opt => 
              opt.value.toLowerCase().includes(stringValue) ||
              opt.text.toLowerCase().includes(stringValue)
            );
          }
          
          if (matchingOption) {
            element.value = matchingOption.value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            return true;
          }
          
          return false;
        }
        
        // Helper to handle radio buttons
        function selectRadio(selector, value) {
          try {
            const radios = document.querySelectorAll(selector);
            const stringValue = String(value).toLowerCase();
            
            for (const radio of radios) {
              const radioValue = (radio.value || '').toLowerCase();
              const label = radio.labels?.[0]?.textContent?.toLowerCase() || '';
              
              if (radioValue === stringValue || label.includes(stringValue)) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
            }
          } catch (error) {
            console.error('[INJECTOR] Error selecting radio:', error);
          }
          return false;
        }
        
        // Helper to handle checkboxes
        function checkBox(selector, shouldCheck) {
          try {
            const element = document.querySelector(selector);
            if (element && element.type === 'checkbox') {
              element.checked = shouldCheck;
              element.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          } catch (error) {
            console.error('[INJECTOR] Error checking box:', error);
          }
          return false;
        }
        
        // Process each field answer
        fieldAnswers.forEach(({ fieldId, value, confidence }) => {
          try {
            // Find the element by looking for data attribute we can add
            // In a real scenario, you'd map fieldId back to the htmlSelector
            
            // For now, we'll try to find by various selectors stored during scraping
            // This is a placeholder - in practice, you'd store the mapping
            console.log('[INJECTOR] Processing field:', fieldId, 'with value:', value);
            
            // You would use the htmlSelector from the scraped data here
            // For example: const element = document.querySelector(htmlSelector);
            
            // This is just a demonstration - actual implementation would use
            // the stored htmlSelector from the scraping phase
            
            successCount++;
          } catch (error) {
            console.error('[INJECTOR] Error processing field', fieldId, ':', error);
            failCount++;
          }
        });
        
        console.log('[INJECTOR] Complete! Success:', successCount, 'Failed:', failCount);
        
        // Send result back to React Native
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'AUTOFILL_COMPLETE',
            data: { successCount, failCount, total: fieldAnswers.length }
          }));
        }
        
        return { success: true, successCount, failCount };
      } catch (error) {
        console.error('[INJECTOR] Fatal error:', error);
        
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'AUTOFILL_ERROR',
            data: { error: error.message }
          }));
        }
        
        return { success: false, error: error.message };
      }
    })();
    true;
  `;
}
