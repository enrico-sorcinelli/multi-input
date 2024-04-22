class MultiInput extends HTMLElement {
  constructor() {
    super();

    // Check for jQuery UI sortable.
    try {
      this._sortable = this.hasAttribute('sortable') && typeof jQuery.ui.sortable === 'function';
    } catch(e) {
      this._sortable = false;
    }

    // This is a hack :^(.
    // ::slotted(input)::-webkit-calendar-picker-indicator doesn't work in any browser.
    // ::slotted() with ::after doesn't work in Safari.
    this.innerHTML +=
    `<style>
    multi-input {
      display: inline-block;
      margin: 5px;
    }
    
    multi-input input  {
      width: 100px;
    }
    multi-input input::-webkit-calendar-picker-indicator {
      display: none;
    }
    /* NB use of pointer-events to only allow events from the × icon */
    multi-input div.item::after {
      color: black;
      content: '×';
      cursor: pointer;
      font-size: 18px;
      pointer-events: auto;
      position: absolute;
      right: 5px;
      top: -1px;
      font-weight: 600;
    }
    multi-input div.item.ui-sortable-handle {
       cursor: move;
    }
    multi-input .ui-sortable-placeholder {
      visibility: visible !important;
      background-color: transparent;
      outline: dashed 1px #ccc;
    }
    multi-input .ui-sortable-placeholder::after {
      display: none;
    }
    multi-input .ui-sortable-helper {
      display: inline-block;
    }
    </style>`;
    this._shadowRoot = this.attachShadow({mode: 'open'});
    this._shadowRoot.innerHTML =
    `<style>
    :host {
      border: var(--multi-input-border, 1px solid #ddd);
      display: block;
      overflow: hidden;
      padding: 5px;
    }
    /* NB use of pointer-events to only allow events from the × icon */
    ::slotted(div.item) {
      background-color: var(--multi-input-item-bg-color, #dedede);
      border: var(--multi-input-item-border, 1px solid #ccc);
      border-radius: 2px;
      color: #222;
      display: inline-block;
      font-size: var(--multi-input-item-font-size, 14px);
      margin: 5px;
      padding: 2px 25px 2px 5px;
      pointer-events: ${ this._sortable ? 'auto' : 'none'};
      position: relative;
      top: -1px;
    }
    /* NB pointer-events: none above */
    ::slotted(div.item:hover) {
      background-color: #eee;
      color: #222;
    }
    ::slotted(input) {
      border: none;
      font-size: var(--multi-input-input-font-size, 14px);
      outline: none;
      padding: 5px 5px 5px 5px; 
    }
    </style>
    <slot></slot>`;

    const selected = [];
    this._datalist = this.querySelector('datalist');
    this._allowedValues = [];

    // Get closed values for init.
    if ( this._datalist ) {
      for (const option of this._datalist.options) {
        this._allowedValues.push(option.value);
        if ( option.hasAttribute('selected') ) {
          selected.push( option.value );
        }
      }
    }
    // Get free values for init.
    else {
      try{
        JSON.parse( this.getAttribute( 'data-value' ) ).forEach( function( el ) {
          selected.push( el );
        });
        //console.log( this.getAttribute( 'data-value' ), selected)
      }
      catch (e) {}

      this._currentValues = this.getValues();
    }

    this._input = this.querySelector('input');
    this._input.onblur = this._handleBlur.bind(this);
    this._input.oninput = this._handleInput.bind(this);
    this._input.onkeydown = (event) => {
      this._handleKeydown(event);
    };

    this._allowDuplicates = this.hasAttribute('allow-duplicates');
    this._maxItems = this.getAttribute( 'max' ) || 0;

    // Add selected values.
    for ( const value of selected ) {
      this._addItem(value);
    }

    // Make sortable.
    if ( this._sortable ) {
      $( this ).sortable( { items: '> .item' } );
    }
  }

  // Called by _handleKeydown() when the value of the input is an allowed value.
  _addItem(value) {

    // Check for duplicates (for free values).
    if ( ! this._allowDuplicates && ! this._datalist ) {
      if ( this.getValues().includes( value ) ) {
        return;
      }
    }

    // Check for mac items.
    if ( this._maxItems > 0 && this.getValues().length >= this._maxItems ) {
      return;
    }

    this._input.value = '';
    const item = document.createElement('div');
    item.classList.add('item');

    // Add sortable handle class.
    if ( this._sortable ) {
      item.classList.add( 'ui-sortable-handle' );
    }

    item.textContent = value;
    this.insertBefore(item, this._input);
    item.onclick = () => {
      this._deleteItem(item);
    };

    // Remove value from datalist options and from _allowedValues array.
    // Value is added back if an item is deleted (see _deleteItem()).
    if (!this._allowDuplicates) {
      if ( this._datalist ) {
        for (const option of this._datalist.options) {
          if (option.value === value) {
            option.remove();
          }
        }
        this._allowedValues =
            this._allowedValues.filter((item) => item !== value);
      }
    }
  }

  // Called when the × icon is tapped/clicked or
  // by _handleKeydown() when Backspace is entered.
  _deleteItem(item) {
    const value = item.textContent;
    item.remove();
    // If duplicates aren't allowed, value is removed (in _addItem())
    // as a datalist option and from the _allowedValues array.
    // So — need to add it back here.
    if (!this._allowDuplicates) {
      if ( this._datalist ) {
        const option = document.createElement('option');
        option.value = value;
        // Insert as first option seems reasonable...
        this._datalist.insertBefore(option, this._datalist.firstChild);
        this._allowedValues.push(value);
      }
    }
  }

  // Avoid stray text remaining in the input element that's not in a div.item.
  _handleBlur() {
    this._input.value = '';
  }

  // Called when input text changes,
  // either by entering text or selecting a datalist option.
  _handleInput() {
    // Add a div.item, but only if the current value
    // of the input is an allowed value
    const value = this._input.value;
    //console.log('_handleInput',this._allowedValues, value)
    if ( this._datalist && this._allowedValues.includes(value) ) {
      this._addItem(value);
    }
  }

  // Called when text is entered or keys pressed in the input element.
  _handleKeydown(event) {
    const itemToDelete = event.target.previousElementSibling;
    const value = this._input.value;
    //console.log('_handleKeydown',this._allowedValues, value, itemToDelete)
    // On Backspace, delete the div.item to the left of the input
    if (value ==='' && event.key === 'Backspace' && itemToDelete) {
      this._deleteItem(itemToDelete);
    // Add a div.item, but only if the current value
    // of the input is an allowed value
    } else if ( this._datalist && this._allowedValues.includes(value)) {
      this._addItem(value);
    }
    // Add arbitrary value.
    else if ( ! this._datalist && value && 'Enter'=== event.key ) {
      this._addItem(value);
    }
  }

  // Public method for getting item values as an array.
  getValues() {
    const values = [];
    const items = this.querySelectorAll('.item');
    for (const item of items) {
      values.push(item.textContent);
    }
    return values;
  }

  // Public method to add multiple values.
  addValues( values ) {
    if ( Array.isArray( values ) ) {
      for ( var i = 0, l = values.length; i < l; i++ ) {
        this._addItem( values[ i ] );
      }
    }
    else {
      this._addItem( values );
    }
  }
}

window.customElements.define('multi-input', MultiInput);
