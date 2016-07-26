/*jshint undef: true, browser:true, nomen: true */
/*jslint browser:true, nomen: true */
/*global mendix, mx, mxui, define, require, console, logger, anno */

/*
    AnnotoriousWidget
    ========================

    @file      : AnnotoriousWidget.js
    @version   : 1.0
    @author    : Marcel Groeneweg
    @date      : Thu, 21 Jul 2016 09:12:10 GMT
    @copyright : Marcel Groeneweg
    @license   : Apache 2

    Documentation
    ========================
    Annotorious library for making annotations on images.
*/

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",

    "mxui/dom",
    "dojo/dom",
    "dojo/dom-prop",
    "dojo/dom-geometry",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/text",
    "dojo/html",
    "dojo/_base/event"
], function (declare, _WidgetBase, dom, dojoDom, dojoProp, dojoGeometry, dojoClass, dojoStyle, dojoConstruct, dojoArray, dojoLang, dojoText, dojoHtml, dojoEvent) {
    "use strict";

    // Declare widget's prototype.
    return declare("AnnotoriousWidget.widget.AnnotoriousWidget", [ _WidgetBase ], {

        // DOM elements
        imgNode: null,

        // Parameters configured in the Modeler.
        annotationDataAttr: "",
        allowChange: true,
        annotationOnChangeMF: "",
        imgClass: "",

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: null,
        _contextObj: null,
        imgUrl: null,

        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function () {
            // Uncomment the following line to enable debug messages
            //logger.level(logger.DEBUG);
            logger.debug(this.id + ".constructor");
            this._handles = [];
        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function () {
            logger.debug(this.id + ".postCreate");
            
            var thisObj = this;

            this.imgNode = document.createElement("img");
            if (this.imgClass) {
                dojoClass.add(this.imgNode, this.imgClass);
            }
            this.domNode.appendChild(this.imgNode);
            if (typeof anno !== "undefined") {
                logger.debug(this.id + ".postCreate, anno object exists");
                thisObj._setupEvents();
            } else {
                require([document.location.origin + "/widgets/AnnotoriousWidget/lib/annotorious.min.js"], function () {
                    logger.debug(thisObj.id + ".postCreate, anno object loaded");
                    thisObj._setupEvents();
                });
            }
        },

        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function (obj, callback) {
            logger.debug(this.id + ".update");

            this._contextObj = obj;
            this._resetSubscriptions();
            this._updateRendering();
            
            // The callback, coming from update, needs to be executed, to let the page know it finished rendering
            mendix.lang.nullExec(callback);
        },

        // mxui.widget._WidgetBase.resize is called when the page's layout is recalculated. Implement to do sizing calculations. Prefer using CSS instead.
        resize: function (box) {
            logger.debug(this.id + ".resize");
        },

        // mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
        uninitialize: function () {
            logger.debug(this.id + ".uninitialize");
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
            if (typeof anno !== "undefined") {
                if (this.imgUrl) {
                    anno.destroy(this.imgUrl);
                    this.imgUrl = null;
                }
            }
        },

        // We want to stop events on a mobile device
        _stopBubblingEventOnMobile: function (e) {
            logger.debug(this.id + "._stopBubblingEventOnMobile");
            if (typeof document.ontouchstart !== "undefined") {
                dojoEvent.stop(e);
            }
        },

        // Attach events to HTML dom elements
        _setupEvents: function () {
            logger.debug(this.id + "._setupEvents");
            if (this.allowChange) {
                anno.addHandler("onAnnotationCreated", dojoLang.hitch(this, this._handleChange));
                anno.addHandler("onAnnotationUpdated", dojoLang.hitch(this, this._handleChange));
                anno.addHandler("onAnnotationRemoved", dojoLang.hitch(this, this._handleChange));
            }
        },

        // Rerender the interface.
        _updateRendering: function () {
            logger.debug(this.id + "._updateRendering");
            var imageObj,
                newImgUrl,
                thisObj = this;
            
            if (this._contextObj !== null) {
                dojoStyle.set(this.domNode, "display", "block");
                
                newImgUrl = document.location.origin + "/file?target=internal&guid=" + this._contextObj.getGuid();
                if (newImgUrl === this.imgUrl) {
                    this._loadAnnotations();
                } else {
                    logger.debug(this.id + "._updateRendering: different URL");
                    if (this.imgUrl) {
                        logger.debug(this.id + "._updateRendering: anno.destroy");
                        anno.destroy(this.imgUrl);
                    }
                    this.imgUrl = newImgUrl;
                    // Use Image object to load the image and only continue when it is in the browser cache.
                    imageObj = new Image();
                    imageObj.onload = function () {
                        thisObj.imgNode.setAttribute("src", thisObj.imgUrl);
                        anno.makeAnnotatable(thisObj.imgNode);
                        thisObj._loadAnnotations();
                    };
                    imageObj.src = newImgUrl;
                }
                

            } else {
                dojoStyle.set(this.domNode, "display", "none");
                if (typeof anno !== "undefined") {
                    if (this.imgUrl) {
                        logger.debug(this.id + "._updateRendering: anno.destroy; no context object");
                        anno.destroy(this.imgUrl);
                    }
                }
                this.imgUrl = null;
            }
        },
        
        _loadAnnotations: function () {
            logger.debug(this.id + "._loadAnnotations");
            var annotationArray,
                annotationJson,
                newAnnotation,
                thisObj = this;
            
            // Mendix calls the update function with a context object and resets it after that. This happens when the cancel button is clicked.
            // This function is called with a setTimeout. By then, another call has been received where the imgUrl (and anno functionality) has been reset.
            if (this.imgUrl === null) {
                return;
            }

            if (!this.allowChange) {
                anno.hideSelectionWidget(this.imgUrl);
            }

            annotationJson = this._contextObj.get(this.annotationDataAttr);
            anno.removeAll(this.imgUrl);
            if (annotationJson) {
                annotationArray = JSON.parse(annotationJson);
                dojoArray.forEach(annotationArray, function (annotationFromDB) {
                    newAnnotation = {
                        src: thisObj.imgUrl,
                        text: annotationFromDB.text,
                        shapes: annotationFromDB.shapes
                    };
                    if (!thisObj.allowChange) {
                        newAnnotation.editable = false;
                    }
                    anno.addAnnotation(newAnnotation);
                });
            }
        },
        
        _handleChange: function () {
            logger.debug(this.id + "._handleChange");
            var annotationArray,
                annotationJson,
                thisObj = this;
            
            if (this.imgUrl) {
                annotationArray = anno.getAnnotations(this.imgUrl);
                annotationJson = JSON.stringify(annotationArray);
                // Function from mendix object to set an attribute.
                this._contextObj.set(this.annotationDataAttr, annotationJson);
                // If a microflow has been set execute the microflow on a click.
                if (this.annotationOnChangeMF !== "") {
                    mx.data.save({
                        mxobj: thisObj._contextObj,
                        callback: function () {
                            mx.data.action({
                                params: {
                                    applyto: "selection",
                                    actionname: thisObj.annotationOnChangeMF,
                                    guids: [ thisObj._contextObj.getGuid() ]
                                },
                                error: function (error) {
                                    logger.error(thisObj.id + ": An error occurred while executing microflow: " + error.description);
                                }
                            });
                        }
                    });
                }
            }
        },

        _unsubscribe: function () {
            if (this._handles) {
                dojoArray.forEach(this._handles, function (handle) {
                    mx.data.unsubscribe(handle);
                });
                this._handles = [];
            }
            if (typeof anno !== "undefined") {
                if (this.imgUrl) {
                    anno.destroy(this.imgUrl);
                    this.imgUrl = null;
                }
            }
        },

        // Reset subscriptions.
        _resetSubscriptions: function () {
            logger.debug(this.id + "._resetSubscriptions");
            
            var objectHandle;
            
            // Release handles on previous object, if any.
            this._unsubscribe();

            // When a mendix object exists create subscribtions.
            if (this._contextObj) {
                objectHandle = mx.data.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: dojoLang.hitch(this, function (guid) {
                        this._updateRendering();
                    })
                });

                this._handles = [ objectHandle ];
            }
        }
    });
});

require(["AnnotoriousWidget/widget/AnnotoriousWidget"]);
