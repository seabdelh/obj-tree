/**
  Copyright (c) 2015, 2018, Oracle and/or its affiliates.
  The Universal Permissive License (UPL), Version 1.0
*/
'use strict';
define(
    [
      'ojs/ojcore', 'knockout', 'jquery', 'ojs/ojdiagram', 'ojs/ojmenu',
      'ojs/ojjsondiagramdatasource'
    ],
    function(oj, ko, $) {
      function mainContentViewModel() {
        const self = this;

        // Assign the treeLayout function to Diagram
        self.layoutFunc = treeLayout;

        // Generate the colors that we will be used for the Diagram nodes
        const colorHandler = new oj.ColorAttributeGroupHandler();

        var i = 0;
        var nodes = [];
        var links = [];
        self.nodeValues = ko.observableArray(nodes);
        self.linkValues = ko.observableArray(links);

        $.getJSON('http://localhost:3000/getAll', function(data) {
          $.each(data, function() {
            nodes.push({
              id: this._id,
              label: this.name + ': ' + this.code,
              icon: {color: colorHandler.getValue('Group ' + this._id)}
            });
            links.push(
                {id: 'L' + i++, startNode: this.parent, endNode: this._id});
            console.log(this._id);
          });
          self.nodeValues(nodes);
          self.linkValues(links);
        })



        self.data = ko.pureComputed(function() {
          return new oj.JsonDiagramDataSource(
              {'nodes': self.nodeValues(), 'links': self.linkValues()});
        });

        self.nodeValues(nodes);
        self.linkValues(links);
        // Style the nodes and links
        self.styleDefaults = {
          nodeDefaults: {icon: {width: 70, height: 70, shape: 'square'}},
          linkDefaults:
              {startConnectorType: 'none', endConnectorType: 'arrow'}
        };

        // context menu bindings
        var node, link;
        self.selectedMenuItem = ko.observable('(None selected yet)');
        self.beforeOpenFunction = function(event) {
          var target = event.detail.originalEvent.target;
          var diagram = document.getElementById('diagram');
          var context = diagram.getContextByNode(target);
          node = null, link = null;
          if (context != null) {
            if (context.subId == 'oj-diagram-node')
              node = diagram.getNode(context['index']);
            else if (context.subId == 'oj-diagram-link')
              link = diagram.getLink(context['index']);
          }
        };
        self.menuItemAction = function(event) {
          var text = event.target.textContent;
          if (node) {
            self.selectedMenuItem(text + ' from Node ' + node.id);
          } else if (link) {
            self.selectedMenuItem(text + ' from Link ' + link.id);
          } else {
            self.selectedMenuItem(text + ' from diagram background');
          }
        };
      }

      /**
       * @param {DvtDiagramLayoutContext} layoutContext the Diagram layout context
       */
      function treeLayout(layoutContext) {
        // Get the node and link counts from the layout context
        var nodeCount = layoutContext.getNodeCount();
        var linkCount = layoutContext.getLinkCount();

        // Create a child-parent map based on the links
        var childParentMap = {};
        for (var i = 0; i < linkCount; i++) {
          var link = layoutContext.getLinkByIndex(i);
          var parentId = link.getStartId();
          var childId = link.getEndId();

          childParentMap[childId] = parentId;
        }
        var parentChildMap = {};
        var maxNodeWidth = 0;
        var maxNodeHeight = 0;

        // Loop though the nodes to create a parent-child map
        // and to find the largest node width and height
        for (var i = 0; i < nodeCount; i++) {
          var node = layoutContext.getNodeByIndex(i);

          var nodeId = node.getId();
          var parentId = childParentMap[nodeId];

          // Keep track of the largest node width and height, for layout
          // purposes
          var nodeBounds = node.getContentBounds();
          maxNodeWidth = Math.max(nodeBounds.w, maxNodeWidth);
          maxNodeHeight = Math.max(nodeBounds.h, maxNodeHeight);

          // Add this node id to the parent-child map for that parent
          // The root nodes (i.e. nodes with no parent) will appear under the
          // key undefined in the parent-child map
          var children = parentChildMap[parentId];
          if (!children) {
            children = [];
            parentChildMap[parentId] = children;
          }
          children.push(nodeId);
        }
        // For horizontal layout, calculate the level width based on the widest
        // node in this level and calculate space for each node based on the
        // tallest node
        var levelSize = maxNodeHeight * 1.5;
        var siblingSize = maxNodeWidth * 1.1;

        // Layout the nodes
        layoutSubTree(
            layoutContext, undefined, parentChildMap, childParentMap, levelSize,
            siblingSize, -1, [0]);

        // Layout the links
        for (var i = 0; i < linkCount; i++) {
          var link = layoutContext.getLinkByIndex(i);
          var parentNode = layoutContext.getNodeById(link.getStartId());
          var childNode = layoutContext.getNodeById(link.getEndId());
          var parentNodePos = parentNode.getPosition();
          var parentNodeBounds = parentNode.getContentBounds();
          var childNodePos = childNode.getPosition();
          var childNodeBounds = childNode.getContentBounds();

          // Draw horizontal link between center of parent right edge and center
          // of child left edge
          var startX =
              parentNodePos.x + parentNodeBounds.x + parentNodeBounds.w * .5
          var startY = parentNodePos.y + parentNodeBounds.y +
              parentNodeBounds.h + link.getStartConnectorOffset();
          ;
          var endX =
              childNodePos.x + childNodeBounds.x + childNodeBounds.w * .5;
          var endY =
              childNodePos.y + childNodeBounds.y - link.getEndConnectorOffset();

          // Set the start, end and the middle points on the link
          link.setPoints([
            startX, startY, startX, (startY + endY) * 0.5, endX,
            (startY + endY) * 0.5, endX, endY
          ]);
        }
      };
      /**
       * Lays out the subtree with the specified root id
       *
       * @param {DvtDiagramLayoutContext} layoutContext the Diagram layout context
       * @param {string} rootId the id of the subtree root, may be null if this is the top-level entry call
       * @param {object} parentChildMap A map from parent id to an array of child ids
       * @param {object} childParentMap A map from child id to parent id
       * @param {number} levelSize The width (including spacing) allocated to each level of the tree
       * @param {number} siblingSize The height (including spacing) allocated to siblings in the same level
       * @param {number} currentDepth the depth of rootId within the tree
       * @param {array} leafPos A singleton array containing the current y position for leaf nodes that will be updated during layout
       *
       * @return {object} the position of the subtree root
       */
      function layoutSubTree(
          layoutContext, rootId, parentChildMap, childParentMap, levelSize,
          siblingSize, currentDepth, leafPos) {
        var currentPos = leafPos[0];
        var childNodes = parentChildMap[rootId];

        // If this is a root node for other child nodes, then layout the child
        // nodes
        if (childNodes) {
          currentPos = 0;
          for (var i = 0; i < childNodes.length; i++) {
            // Layout the child subtrees recursively
            var childPosition = layoutSubTree(
                layoutContext, childNodes[i], parentChildMap, childParentMap,
                levelSize, siblingSize, currentDepth + 1, leafPos);

            // Center parent node vertically next to the children
            currentPos += childPosition.x / childNodes.length;
          }
        } else {
          // Leaf node, advance the current leaf position
          leafPos[0] += siblingSize;
        }

        var position = {x: currentPos, y: currentDepth * levelSize};

        if (rootId) {
          var root = layoutContext.getNodeById(rootId);
          if (root) {
            var bounds = root.getContentBounds();
            var rootPos = {
              x: position.x,
              y: position.y - bounds.y - bounds.h * .5
            };
            root.setPosition(rootPos);

            // Center the label inside the node
            var nodeLabelBounds = root.getLabelBounds();
            if (nodeLabelBounds) {
              var labelX =
                  bounds.x + rootPos.x + 0.5 * (bounds.w - nodeLabelBounds.w);
              var labelY =
                  bounds.y + rootPos.y + 0.5 * (bounds.h - nodeLabelBounds.h);
              root.setLabelPosition({'x': labelX, 'y': labelY});
            }
          }
        }
        return position;
      };


      return new mainContentViewModel();
    });